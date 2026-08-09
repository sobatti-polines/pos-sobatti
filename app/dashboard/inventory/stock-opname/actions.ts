"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                        */
/* ------------------------------------------------------------------ */

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, pengguna: null };

  const username = user.email?.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("id, level, username")
    .eq("username", username)
    .single();

  return { supabase, pengguna };
}

function requireAdmin(pengguna: { level: string } | null): string | null {
  if (!pengguna) return "Unauthorized";
  if (pengguna.level !== "ADMIN" && pengguna.level !== "OWNER") {
    return "Akses ditolak — hanya ADMIN/OWNER";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Format no_sesi: OP-YYYYMMDD-NN                                     */
/* ------------------------------------------------------------------ */

function todayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

async function generateNoSesi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tgl: string
): Promise<string> {
  const prefix = `OP-${tgl.replace(/-/g, "")}-`;

  const { data } = await supabase
    .from("sesi_stok_opname")
    .select("no_sesi")
    .like("no_sesi", `${prefix}%`)
    .order("no_sesi", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].no_sesi;
    const parts = last.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) next = lastNum + 1;
  }

  return `${prefix}${String(next).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  1. createSesiOpname                                                 */
/* ------------------------------------------------------------------ */

export async function createSesiOpname(input: {
  tgl_sesi?: string;
  keterangan?: string;
}) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const tgl = input.tgl_sesi || todayStr();
  const no_sesi = await generateNoSesi(supabase, tgl);

  const { data, error } = await supabase
    .from("sesi_stok_opname")
    .insert({
      no_sesi,
      tgl_sesi: tgl,
      status: "DRAFT",
      id_pengguna: pengguna!.id,
      keterangan: input.keterangan || null,
    })
    .select("id, no_sesi")
    .single();

  if (error) {
    console.error("Create sesi opname error:", error);
    return { error: "Gagal membuat sesi opname: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "sesi_stok_opname",
    deskripsi: buildDeskripsi({
      aksi: "CREATE",
      entitas: "sesi_stok_opname",
      data_baru: { no_sesi, tgl_sesi: tgl } as unknown as Record<string, unknown>,
    }),
    data_baru: { no_sesi, tgl_sesi: tgl } as unknown as Record<string, unknown>,
  });

  return { success: true, id: data.id, no_sesi: data.no_sesi };
}

/* ------------------------------------------------------------------ */
/*  2. saveOpnameDraft                                                  */
/* ------------------------------------------------------------------ */

export async function saveOpnameDraft(input: {
  id_sesi: string;
  items: Array<{
    id_produk: number;
    stok_fisik: number;
    klasifikasi?: string | null;
    keterangan?: string;
  }>;
}) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  // Verify sesi is DRAFT
  const { data: sesi } = await supabase
    .from("sesi_stok_opname")
    .select("id, status")
    .eq("id", input.id_sesi)
    .single();

  if (!sesi) return { error: "Sesi opname tidak ditemukan" };
  if (sesi.status !== "DRAFT") return { error: "Sesi sudah diproses — tidak bisa diedit" };

  // Delete existing rows for this sesi (replace)
  await supabase.from("stok_opname").delete().eq("id_sesi", input.id_sesi);

  // Fetch current stok & harga_pokok_avco for snapshot
  const productIds = input.items.map((i) => i.id_produk);
  const { data: produkRows } = await supabase
    .from("produk")
    .select("id, stok, stok_gudang, harga_pokok_avco")
    .in("id", productIds);

  const produkMap = new Map(
    (produkRows ?? []).map((p) => [p.id, p])
  );

  // Build insert rows
  const rows = input.items
    .filter((item) => item.id_produk > 0)
    .map((item) => {
      const produk = produkMap.get(item.id_produk);
      const stokSistem = (produk?.stok ?? 0) + (produk?.stok_gudang ?? 0);
      const hargaSnap = produk?.harga_pokok_avco ?? 0;
      const selisih = item.stok_fisik - stokSistem;

      return {
        id_sesi: input.id_sesi,
        id_produk: item.id_produk,
        tgl_opname: todayStr(),
        stok_sistem: stokSistem,
        stok_fisik: item.stok_fisik,
        selisih,
        klasifikasi: item.klasifikasi || null,
        harga_pokok_snap: hargaSnap,
        keterangan: item.keterangan || null,
        id_pengguna: pengguna!.id,
      };
    });

  if (rows.length === 0) {
    return { error: "Tidak ada data valid untuk disimpan" };
  }

  const { error: insertError } = await supabase.from("stok_opname").insert(rows);

  if (insertError) {
    console.error("Save draft opname error:", insertError);
    return { error: "Gagal menyimpan draft: " + insertError.message };
  }

  // Update sesi totals
  const totalItem = rows.length;
  const totalSelisih = rows.reduce((sum, r) => sum + (r.selisih ?? 0), 0);
  const totalNilai = rows.reduce(
    (sum, r) => sum + (r.selisih ?? 0) * (r.harga_pokok_snap ?? 0),
    0
  );

  await supabase
    .from("sesi_stok_opname")
    .update({ total_item: totalItem, total_selisih: totalSelisih, total_nilai: totalNilai })
    .eq("id", input.id_sesi);

  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true, total_item: totalItem };
}

/* ------------------------------------------------------------------ */
/*  3. refreshSnapshot — update stok_sistem ke stok terkini             */
/* ------------------------------------------------------------------ */

export async function refreshSnapshot(id_sesi: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  // Get all items in sesi
  const { data: items } = await supabase
    .from("stok_opname")
    .select("id, id_produk")
    .eq("id_sesi", id_sesi);

  if (!items || items.length === 0) return { error: "Tidak ada item dalam sesi" };

  // Fetch current stok
  const productIds = items.map((i) => i.id_produk);
  const { data: produkRows } = await supabase
    .from("produk")
    .select("id, stok, stok_gudang")
    .in("id", productIds);

  const produkMap = new Map((produkRows ?? []).map((p) => [p.id, (p.stok ?? 0) + (p.stok_gudang ?? 0)]));

  // Update each row
  for (const item of items) {
    const newStok = produkMap.get(item.id_produk) ?? 0;
    await supabase
      .from("stok_opname")
      .update({ stok_sistem: newStok, selisih: undefined })
      .eq("id", item.id);
  }

  // Recalculate selisih
  const { data: updatedItems } = await supabase
    .from("stok_opname")
    .select("id, stok_sistem, stok_fisik, harga_pokok_snap")
    .eq("id_sesi", id_sesi);

  if (updatedItems) {
    for (const item of updatedItems) {
      const selisih = (item.stok_fisik ?? 0) - (item.stok_sistem ?? 0);
      await supabase
        .from("stok_opname")
        .update({ selisih })
        .eq("id", item.id);
    }

    const totalSelisih = updatedItems.reduce(
      (sum, i) => sum + ((i.stok_fisik ?? 0) - (i.stok_sistem ?? 0)),
      0
    );
    const totalNilai = updatedItems.reduce(
      (sum, i) =>
        sum + ((i.stok_fisik ?? 0) - (i.stok_sistem ?? 0)) * (i.harga_pokok_snap ?? 0),
      0
    );

    await supabase
      .from("sesi_stok_opname")
      .update({ total_selisih: totalSelisih, total_nilai: totalNilai })
      .eq("id", id_sesi);
  }

  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  4. applyOpname — final apply via RPC                                */
/* ------------------------------------------------------------------ */

export async function applyOpname(id_sesi: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const { data, error: rpcError } = await supabase.rpc(
    "process_stok_opname_apply",
    { p_id_sesi: id_sesi }
  );

  if (rpcError) {
    console.error("Apply opname RPC error:", rpcError);
    return { error: "Gagal menerapkan opname: " + rpcError.message };
  }

  if (data?.error) {
    return { error: data.error };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "sesi_stok_opname",
    deskripsi: buildDeskripsi({
      aksi: "UPDATE",
      entitas: "sesi_stok_opname",
      id_entitas: 0,
      data_baru: { id_sesi, result: data } as unknown as Record<string, unknown>,
    }),
    data_baru: { id_sesi, result: data } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory/stock-opname");
  revalidatePath("/dashboard/inventory/stock-opname/history");
  revalidatePath("/dashboard/inventory");
  return { success: true, ...data };
}

/* ------------------------------------------------------------------ */
/*  5. batalkanOpname — cancel DRAFT sesi                               */
/* ------------------------------------------------------------------ */

export async function batalkanOpname(id_sesi: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const { data, error: rpcError } = await supabase.rpc(
    "batalkan_sesi_stok_opname",
    { p_id_sesi: id_sesi }
  );

  if (rpcError) {
    console.error("Batalkan opname RPC error:", rpcError);
    return { error: "Gagal membatalkan sesi: " + rpcError.message };
  }

  if (data?.error) {
    return { error: data.error };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "sesi_stok_opname",
    deskripsi: buildDeskripsi({
      aksi: "DELETE",
      entitas: "sesi_stok_opname",
      id_entitas: 0,
      data_lama: { id_sesi } as unknown as Record<string, unknown>,
    }),
    data_lama: { id_sesi } as unknown as Record<string, unknown>,
  });

  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  6. hapusBarisOpname — delete single row from DRAFT sesi             */
/* ------------------------------------------------------------------ */

export async function hapusBarisOpname(id_baris: number) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  // Check sesi status
  const { data: baris } = await supabase
    .from("stok_opname")
    .select("id_sesi, sesi_stok_opname(status)")
    .eq("id", id_baris)
    .single();

  if (!baris) return { error: "Baris tidak ditemukan" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sesiStatus = (baris as any).sesi_stok_opname?.status;
  if (sesiStatus && sesiStatus !== "DRAFT") {
    return { error: "Hanya baris dari sesi DRAFT yang bisa dihapus" };
  }

  await supabase.from("stok_opname").delete().eq("id", id_baris);

  revalidatePath("/dashboard/inventory/stock-opname");
  return { success: true };
}
