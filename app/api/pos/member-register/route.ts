import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logActivity, buildDeskripsi } from "@/lib/activity-log";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { nama_pelanggan, no_hp } = await request.json();

  if (!nama_pelanggan?.trim()) {
    return NextResponse.json(
      { error: "Nama pelanggan wajib diisi" },
      { status: 400 }
    );
  }

  if (!no_hp?.trim()) {
    return NextResponse.json(
      { error: "Nomor HP wajib diisi" },
      { status: 400 }
    );
  }

  const trimmedNoHp = no_hp.trim();
  const trimmedNama = nama_pelanggan.trim();

  const { data: existing } = await supabase
    .from("pelanggan")
    .select("id")
    .eq("no_hp", trimmedNoHp)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Nomor HP sudah terdaftar sebagai member" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("pelanggan")
    .insert([
      {
        nama_pelanggan: trimmedNama,
        no_hp: trimmedNoHp,
        point: 0,
      },
    ])
    .select("id, nama_pelanggan, alamat, no_hp, email, point")
    .single();

  if (error) {
    console.error("Member register error:", error);

    if (error.code === "23505") {
      const { error: seqError } = await supabaseAdmin.rpc("reset_pelanggan_id_seq");
      if (!seqError) {
        const { data: retryData, error: retryError } = await supabase
          .from("pelanggan")
          .insert([
            {
              nama_pelanggan: trimmedNama,
              no_hp: trimmedNoHp,
              point: 0,
            },
          ])
          .select("id, nama_pelanggan, alamat, no_hp, email, point")
          .single();

        if (!retryError && retryData) {
          return NextResponse.json(retryData);
        }
      }
    }

    return NextResponse.json(
      { error: "Gagal mendaftarkan member" },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    aksi: "CREATE",
    entitas: "pelanggan",
    id_entitas: data?.id ?? null,
    deskripsi: buildDeskripsi({ aksi: "CREATE", entitas: "pelanggan", data_baru: { nama_pelanggan: trimmedNama, no_hp: trimmedNoHp } as unknown as Record<string, unknown> }),
    data_baru: { nama_pelanggan: trimmedNama, no_hp: trimmedNoHp } as unknown as Record<string, unknown>,
  });

  return NextResponse.json(data);
}
