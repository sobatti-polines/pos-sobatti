"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { logActivity } from "@/lib/activity-log";

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

const revalidateKasAdmin = () => {
  revalidatePath("/dashboard/keuangan/kas-admin");
  revalidatePath("/dashboard/laporan/neraca");
  revalidatePath("/dashboard/keuangan/arus-kas");
  revalidatePath("/dashboard");
};

/* ------------------------------------------------------------------ */
/*  1. addKasAdminTopup — penambahan saldo kas admin dari owner         */
/* ------------------------------------------------------------------ */

const topupSchema = z.object({
  tanggal: z
    .string()
    .min(1, "Tanggal wajib diisi")
    .refine((v) => !isNaN(new Date(v).getTime()), "Tanggal tidak valid"),
  jumlah: z.number().positive("Jumlah harus lebih dari 0"),
  keterangan: z.string().optional(),
});

export async function addKasAdminTopup(input: z.infer<typeof topupSchema>) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = topupSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data, error } = await supabase
    .from("kas_admin_topup")
    .insert({
      tanggal: parsed.data.tanggal,
      jumlah: parsed.data.jumlah,
      keterangan: parsed.data.keterangan?.trim() || null,
      id_pengguna: pengguna!.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Add kas admin topup error:", error);
    return { error: "Gagal menambah saldo kas admin: " + error.message };
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "kas_admin_topup",
    deskripsi: `Penambahan saldo Kas Admin: ${new Intl.NumberFormat("id-ID").format(Number(parsed.data.jumlah))} pada ${parsed.data.tanggal}${parsed.data.keterangan ? ` (${parsed.data.keterangan.trim()})` : ""}`,
    data_baru: parsed.data as unknown as Record<string, unknown>,
  });

  revalidateKasAdmin();
  return { success: true, id: data.id };
}

/* ------------------------------------------------------------------ */
/*  2. editKasAdminTopup — koreksi penambahan saldo yang salah input     */
/* ------------------------------------------------------------------ */

const editTopupSchema = z.object({
  id: z.string().min(1, "ID tidak valid"),
  tanggal: z
    .string()
    .min(1, "Tanggal wajib diisi")
    .refine((v) => !isNaN(new Date(v).getTime()), "Tanggal tidak valid"),
  jumlah: z.number().positive("Jumlah harus lebih dari 0"),
  keterangan: z.string().optional(),
});

export async function editKasAdminTopup(input: z.infer<typeof editTopupSchema>) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  const parsed = editTopupSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    return { error: messages.join(". ") };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("kas_admin_topup")
    .select("id, tanggal, jumlah, keterangan")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !existing) {
    return { error: "Penambahan saldo tidak ditemukan" };
  }

  const { error: updateError } = await supabase
    .from("kas_admin_topup")
    .update({
      tanggal: parsed.data.tanggal,
      jumlah: parsed.data.jumlah,
      keterangan: parsed.data.keterangan?.trim() || null,
    })
    .eq("id", parsed.data.id);

  if (updateError) {
    console.error("Edit kas admin topup error:", updateError);
    return { error: "Gagal mengedit penambahan saldo" };
  }

  await logActivity(supabase, {
    aksi: "UPDATE",
    entitas: "kas_admin_topup",
    deskripsi: `Mengedit penambahan saldo Kas Admin (${existing.tanggal}): ${new Intl.NumberFormat("id-ID").format(Number(existing.jumlah))} → ${new Intl.NumberFormat("id-ID").format(Number(parsed.data.jumlah))}`,
    data_lama: {
      id: existing.id,
      tanggal: existing.tanggal,
      jumlah: existing.jumlah,
      keterangan: existing.keterangan,
    } as unknown as Record<string, unknown>,
    data_baru: parsed.data as unknown as Record<string, unknown>,
  });

  revalidateKasAdmin();
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  3. deleteKasAdminTopup — batalkan penambahan saldo yang salah        */
/* ------------------------------------------------------------------ */

export async function deleteKasAdminTopup(id: string) {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  if (!id) return { error: "ID tidak valid" };

  const { data: existing, error: fetchError } = await supabase
    .from("kas_admin_topup")
    .select("id, tanggal, jumlah, keterangan")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { error: "Penambahan saldo tidak ditemukan" };
  }

  const { error: deleteError } = await supabase
    .from("kas_admin_topup")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Delete kas admin topup error:", deleteError);
    return { error: "Gagal menghapus penambahan saldo" };
  }

  await logActivity(supabase, {
    aksi: "DELETE",
    entitas: "kas_admin_topup",
    deskripsi: `Menghapus penambahan saldo Kas Admin: ${new Intl.NumberFormat("id-ID").format(Number(existing.jumlah))} pada ${existing.tanggal}`,
    data_lama: {
      id: existing.id,
      tanggal: existing.tanggal,
      jumlah: existing.jumlah,
      keterangan: existing.keterangan,
    } as unknown as Record<string, unknown>,
  });

  revalidateKasAdmin();
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  4. getKasAdminData — saldo, mutasi (masuk & keluar), ringkasan       */
/* ------------------------------------------------------------------ */

export type KasAdminMutasi = {
  id: string;
  tanggal: string;
  jenis: "MASUK" | "KELUAR";
  keterangan: string;
  sumber: "topup" | "retur" | "pengeluaran";
  jumlah: number;
  oleh: string | null;
};

export async function getKasAdminData() {
  const { supabase, pengguna } = await getAuthUser();
  if (!supabase) return { error: "Unauthorized" };

  const err = requireAdmin(pengguna);
  if (err) return { error: err };

  // MASUK: penambahan saldo (topup) dari owner
  const topups = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("kas_admin_topup")
      .select("id, tanggal, jumlah, keterangan, pengguna(nama, username)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  // MASUK: refund retur pembelian (uang kembali ke kas operasional)
  const returs = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("retur_pembelian")
      .select("id, no_retur, tgl_retur, total_nilai")
      .order("tgl_retur", { ascending: false })
      .range(from, to)
  );

  // KELUAR: pengeluaran operasional Tunai AKTIF
  const pengeluaran = await fetchAllRows(supabase, (db, from, to) =>
    db
      .from("pengeluaran")
      .select(
        "id, tanggal, nama_pengeluaran, jumlah, keterangan, kategori_beban(nama), pengguna!pengeluaran_id_pengguna_fkey(nama, username)"
      )
      .eq("status", "AKTIF")
      .eq("metode_bayar", "Tunai")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  const getNama = (rel: unknown): string | null => {
    if (Array.isArray(rel)) {
      const first = rel[0] as { nama?: string; username?: string } | undefined;
      return first?.nama || first?.username || null;
    }
    const obj = rel as { nama?: string; username?: string } | null;
    return obj?.nama || obj?.username || null;
  };

  const mutasi: KasAdminMutasi[] = [];

  for (const t of topups ?? []) {
    mutasi.push({
      id: `topup-${t.id}`,
      tanggal: t.tanggal,
      jenis: "MASUK",
      keterangan: t.keterangan || "Penambahan saldo dari owner",
      sumber: "topup",
      jumlah: Number(t.jumlah || 0),
      oleh: getNama(t.pengguna),
    });
  }

  for (const r of returs ?? []) {
    mutasi.push({
      id: `retur-${r.id}`,
      tanggal: r.tgl_retur,
      jenis: "MASUK",
      keterangan: `Refund retur pembelian (${r.no_retur})`,
      sumber: "retur",
      jumlah: Number(r.total_nilai || 0),
      oleh: null,
    });
  }

  for (const p of pengeluaran ?? []) {
    const kategori = Array.isArray(p.kategori_beban)
      ? (p.kategori_beban[0] as { nama?: string } | undefined)?.nama
      : (p.kategori_beban as unknown as { nama?: string } | null)?.nama;
    mutasi.push({
      id: `pengeluaran-${p.id}`,
      tanggal: p.tanggal,
      jenis: "KELUAR",
      keterangan: `Pengeluaran: ${p.nama_pengeluaran}${kategori ? ` (${kategori})` : ""}`,
      sumber: "pengeluaran",
      jumlah: Number(p.jumlah || 0),
      oleh: getNama(p.pengguna),
    });
  }

  mutasi.sort((a, b) => {
    if (a.tanggal === b.tanggal) return 0;
    return a.tanggal < b.tanggal ? 1 : -1;
  });

  // Saldo kumulatif (seluruh data) — rollover otomatis
  const saldo = mutasi.reduce(
    (acc, m) => acc + (m.jenis === "MASUK" ? m.jumlah : -m.jumlah),
    0
  );

  // Ringkasan bulan berjalan
  const now = new Date();
  const monthStart = now.toISOString().slice(0, 7); // yyyy-MM
  const bulanIni = mutasi.filter((m) => m.tanggal.startsWith(monthStart));
  const totalMasukBulan = bulanIni
    .filter((m) => m.jenis === "MASUK")
    .reduce((acc, m) => acc + m.jumlah, 0);
  const totalKeluarBulan = bulanIni
    .filter((m) => m.jenis === "KELUAR")
    .reduce((acc, m) => acc + m.jumlah, 0);

  return {
    data: {
      saldo,
      total_masuk_bulan: totalMasukBulan,
      total_keluar_bulan: totalKeluarBulan,
      mutasi: mutasi.slice(0, 500),
    },
  };
}
