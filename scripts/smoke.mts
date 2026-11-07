// Smoke HTTP terhadap aplikasi yang berjalan (`pnpm start`), tanpa impor modul auth.
// Fase auth (Commit 2). Data uji memakai prefix email `smoke-` dan dibersihkan
// di akhir lewat DB langsung. Jalankan serial: satu skenario setelah skenario lain.
import crypto from "node:crypto";
import { Client } from "pg";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordBaru = process.env.SMOKE_ADMIN_PASSWORD_BARU ?? "AdminBaru123!";
const stempel = Date.now();
const emailPertama = `smoke-anggota-a-${stempel}@seed.local`;
const emailKedua = `smoke-anggota-b-${stempel}@seed.local`;
const emailSupervisor = `smoke-supervisor-${stempel}@seed.local`;
const emailAtasan = `smoke-atasan-${stempel}@seed.local`;
const emailLain = `smoke-lain-${stempel}@seed.local`;
const emailMasaDepan = `smoke-masa-depan-${stempel}@seed.local`;
const passwordAwal = "SmokeAwal123!";
const passwordBaru = "SmokeBaru456!";

if (!adminPassword) {
  console.error("smoke: ADMIN_PASSWORD wajib diisi (jalankan dengan --env-file=.env.local).");
  process.exit(1);
}
// Password admin yang dipakai skrip (ganti-password mengubahnya di DB).
const passwordAdminAktif = process.env.SMOKE_ADMIN_PASSWORD ?? adminPassword;

function buatJar() {
  // Set-Cookie di-pisah per atribut: header gabungan bisa memuat koma di `Expires`.
  let cookies: { name: string; value: string }[] = [];
  function cookieHeader() {
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }
  function absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const atribut = raw.split(";").map((a) => a.trim());
      const [pair, ...sisa] = atribut;
      const i = pair!.indexOf("=");
      const name = pair!.slice(0, i).trim();
      const value = pair!.slice(i + 1).trim();
      const dihapus = value === "" || /^max-age=0$/i.test(sisa.find((a) => /^max-age=/i.test(a)) ?? "");
      cookies = cookies.filter((c) => c.name !== name);
      if (!dihapus) cookies.push({ name, value });
    }
  }
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(base + path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
        cookie: cookieHeader(),
        origin: base,
      },
      redirect: "manual",
    });
    absorb(res);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* bukan JSON */
    }
    return { status: res.status, text, json };
  }
  return { call };
}

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ${detail}`);
  if (!ok) process.exitCode = 1;
}

function kode(json: any): string {
  return json?.error?.code ?? "-";
}

async function masuk(jar: ReturnType<typeof buatJar>, email: string, password: string) {
  return jar.call("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

function uuidDari(kunci: string): string {
  const hex = crypto.createHash("sha1").update(kunci).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Tanggal WIB (Asia/Jakarta, UTC+7) — skrip bisa berjalan di zona waktu lain.
function tanggalWIB(hariLalu: number): string {
  return new Date(Date.now() + 7 * 3600_000 - hariLalu * 86_400_000).toISOString().slice(0, 10);
}

function mulaiPekan(selisih: number): string {
  const d = new Date(`${tanggalWIB(0)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + selisih * 7);
  return d.toISOString().slice(0, 10);
}

function bulanDepan(bulanAwal: string): string {
  const [y, m] = bulanAwal.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);
}

function tambahHari(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

const anggota = buatJar();
const sup = buatJar();
const atasan = buatJar();
const lain = buatJar();
let idSup = "";
let idAnak = "";

// Admin hasil seed-admin wajib ganti password; smoke mengubahnya ke
// SMOKE_ADMIN_PASSWORD_BARU, jadi sesi sebelumnya memakai password itu.
let passwordSesiAdmin = "";
async function masukAdmin() {
  for (const [i, password] of kandidatAdmin.entries()) {
    const jar = buatJar();
    const r = await masuk(jar, adminEmail!, password);
    if (r.status === 200) {
      if (i > 0) console.log("INFO  admin login memakai password kandidat berikutnya");
      passwordSesiAdmin = password;
      return jar;
    }
  }
  return buatJar();
}

async function jalankanFase(): Promise<void> {
  const sesiAdmin = await admin.call("/api/auth/get-session");
  check(
    "admin login",
    sesiAdmin.json?.user?.email === adminEmail,
    `user=${sesiAdmin.json?.user?.email ?? "-"}`,
  );

  // 2. Sign-up publik ditolak (disableSignUp).
  {
    const anon = buatJar();
    const r = await anon.call("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({
        email: `smoke-signup-${stempel}@seed.local`,
        password: passwordAwal,
        name: "Coba Daftar",
      }),
    });
    check("sign-up publik ditolak", r.status === 400 || r.status === 403, `status=${r.status}`);
  }

  // 3. Tanpa sesi → 401 dengan format error standar.
  {
    const anon = buatJar();
    const r = await anon.call("/api/me");
    check(
      "tanpa sesi → 401 UNAUTHORIZED",
      r.status === 401 && kode(r.json) === "UNAUTHORIZED",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }

  // 4. Admin wajib ganti password dulu sebelum endpoint lain (hanya pada seed
  // baru; ID flag di DB mengingat smoke yang menulis ulang password yang sama).
  {
    const awal = await admin.call("/api/me");
    const baruDiseed = adminPassword === adminPasswordBaru;
    if (awal.json?.data?.harusGantiPassword === true && !baruDiseed) {
      const r = await admin.call("/api/admin/karyawan", {
        method: "POST",
        body: JSON.stringify({ nama: "X", email: `smoke-cek-${stempel}@seed.local`, password: passwordAwal, level: "Tetap" }),
      });
      check(
        "admin wajib ganti password → 403 PASSWORD_CHANGE_REQUIRED",
        r.status === 403 && kode(r.json) === "PASSWORD_CHANGE_REQUIRED",
        `status=${r.status} code=${kode(r.json)}`,
      );
    } else {
      console.log("SKIP  admin wajib ganti password (flag sudah false dari sesi sebelumnya)");
    }

    if (passwordSesiAdmin === adminPasswordBaru) {
      console.log("SKIP  admin ganti password (sudah memakai SMOKE_ADMIN_PASSWORD_BARU)");
    } else {
      const akhir = await admin.call("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: passwordSesiAdmin, newPassword: adminPasswordBaru }),
      });
      check("admin ganti password", akhir.status === 200, `status=${akhir.status} ${akhir.text.slice(0, 80)}`);
      // revokeOtherSessions mencabut sesi lama; masuk ulang dengan password baru.
      kandidatAdmin = [adminPasswordBaru];
      admin = await masukAdmin();
    }

    const me = await admin.call("/api/me");
    check(
      "flag admin ter-reset",
      me.status === 200 && me.json?.data?.harusGantiPassword === false,
      `status=${me.status} harusGantiPassword=${me.json?.data?.harusGantiPassword ?? "-"}`,
    );
  }

  // 5. Validasi pembuatan karyawan.
  {
    const r = await admin.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({ nama: "", email: "bukan-email", password: "x", level: "Tetap" }),
    });
    check("body tidak valid → 400 VALIDATION", r.status === 400 && kode(r.json) === "VALIDATION", `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const r = await admin.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({
        nama: "Smoke Magang",
        email: emailPertama,
        password: passwordAwal,
        level: "Magang",
        supervisorId: null,
      }),
    });
    check(
      "magang tanpa supervisor ditolak",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await admin.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({
        nama: "Smoke Anggota",
        email: emailPertama,
        password: passwordAwal,
        level: "Tetap",
        supervisorId: null,
      }),
    });
    check(
      "admin buat karyawan",
      r.status === 201 && r.json?.data?.email === emailPertama && r.json?.data?.harusGantiPassword === true,
      `status=${r.status} email=${r.json?.data?.email ?? "-"}`,
    );
  }
  {
    const r = await admin.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({ nama: "Duplikat", email: emailPertama, password: passwordAwal, level: "Tetap" }),
    });
    check("email duplikat ditolak", r.status === 400, `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const sesi = await admin.call("/api/auth/get-session");
    check(
      "sesi admin tidak tertimpa autoSignIn",
      sesi.json?.user?.email === adminEmail,
      `user=${sesi.json?.user?.email ?? "-"}`,
    );
  }
  // 6. Karyawan baru: password awal tidak bisa dipakai ke API sampai diganti.
  {
    const r = await masuk(anggota, emailPertama, passwordAwal);
    check("karyawan login dengan password awal", r.status === 200, `status=${r.status}`);
  }
  {
    const r = await anggota.call("/api/me");
    check(
      "/api/me tetap bisa diakses saat wajib ganti password",
      r.status === 200 && r.json?.data?.harusGantiPassword === true,
      `status=${r.status} harusGantiPassword=${r.json?.data?.harusGantiPassword ?? "-"}`,
    );
  }
  {
    const r = await anggota.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({ nama: "X", email: emailKedua, password: passwordAwal, level: "Tetap" }),
    });
    check(
      "endpoint lain → 403 PASSWORD_CHANGE_REQUIRED",
      r.status === 403 && kode(r.json) === "PASSWORD_CHANGE_REQUIRED",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await anggota.call("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "salah-banget", newPassword: passwordBaru }),
    });
    check("ganti password dengan password lama salah ditolak", r.status >= 400, `status=${r.status}`);
  }
  {
    const r = await anggota.call("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: passwordAwal, newPassword: passwordBaru }),
    });
    check("karyawan ganti password", r.status === 200, `status=${r.status} ${r.text.slice(0, 80)}`);
  }
  {
    const r = await anggota.call("/api/me");
    check(
      "flag karyawan ter-reset",
      r.status === 200 && r.json?.data?.harusGantiPassword === false,
      `status=${r.status} harusGantiPassword=${r.json?.data?.harusGantiPassword ?? "-"}`,
    );
  }
  {
    const r = await anggota.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({ nama: "X", email: emailKedua, password: passwordAwal, level: "Tetap" }),
    });
    check(
      "karyawan non-admin → 403 FORBIDDEN",
      r.status === 403 && kode(r.json) === "FORBIDDEN",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const lain = buatJar();
    const r = await masuk(lain, emailPertama, passwordAwal);
    check("password lama tidak berlaku setelah ganti", r.status === 401, `status=${r.status}`);
  }
  {
    const lain = buatJar();
    const r = await masuk(lain, emailPertama, passwordBaru);
    check("login dengan password baru", r.status === 200, `status=${r.status}`);
  }

  // 7. Karyawan nonaktif tidak bisa login (session.create.before).
  {
    if (!process.env.DATABASE_URL_UNPOOLED) {
      console.log("SKIP  sesi karyawan nonaktif (DATABASE_URL_UNPOOLED tidak ada)");
    } else {
      const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
      await client.connect();
      await client.query(
        `UPDATE karyawan SET aktif = false WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
        [emailPertama],
      );
      await client.end();
      const lain = buatJar();
      const r = await masuk(lain, emailPertama, passwordBaru);
      check("karyawan nonaktif tidak bisa login", r.status >= 400, `status=${r.status}`);
    }
  }
}

async function faseLaporan() {
  // Laporan pekan (Commit 3).
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.log("SKIP  fase laporan (DATABASE_URL_UNPOOLED tidak ada)");
  } else {
    const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await client.connect();
    try {
      // Rantai supervisi atasan → sup → anak (emailPertama). Ketiganya dibuat
      // lewat jalur admin supaya profil karyawan dibuat databaseHooks.
      for (const [email, nama] of [
        [emailSupervisor, "Smoke Supervisor"],
        [emailAtasan, "Smoke Atasan"],
        [emailLain, "Smoke Lain"],
      ] as const) {
        const r = await admin.call("/api/admin/karyawan", {
          method: "POST",
          body: JSON.stringify({ nama, email, password: passwordAwal, level: "Tetap" }),
        });
        check(`admin buat ${nama}`, r.status === 201, `status=${r.status} code=${kode(r.json)}`);
      }
      const cariId = await client.query(
        `SELECT u.email, k.id FROM karyawan k JOIN "user" u ON u.id = k.user_id
         WHERE u.email = ANY($1::text[])`,
        [[emailSupervisor, emailAtasan, emailPertama]],
      );
      const idPer = new Map(cariId.rows.map((row) => [row.email as string, row.id as string]));
      idSup = idPer.get(emailSupervisor) ?? "";
      idAnak = idPer.get(emailPertama) ?? "";
      const idAtasan = idPer.get(emailAtasan) ?? "";
      if (!idSup || !idAnak || !idAtasan) throw new Error("idsmoke: profil karyawan tidak ditemukan");
      await client.query(
        `UPDATE karyawan SET harus_ganti_password = false
         WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1::text[]))`,
        [[emailSupervisor, emailAtasan, emailLain]],
      );
      await client.query(`UPDATE karyawan SET supervisor_id = $1 WHERE id = $2`, [idAtasan, idSup]);
      await client.query(
        `UPDATE karyawan SET supervisor_id = $1, aktif = true WHERE user_id = (SELECT id FROM "user" WHERE email = $2)`,
        [idSup, emailPertama],
      );
    } finally {
      await client.end();
    }

    for (const [jar, email, label] of [
      [sup, emailSupervisor, "supervisor"],
      [atasan, emailAtasan, "atasan"],
      [lain, emailLain, "orang lain"],
    ] as const) {
      const r = await masuk(jar, email, passwordAwal);
      check(`login ${label}`, r.status === 200, `status=${r.status}`);
    }

    // Bootstrap: Draf baru untuk pekan berjalan + satu baris untuk anak.
    let laporanId = "";
    let idPekan = "";
    {
      const r = await sup.call("/api/pekan/bootstrap", { method: "POST" });
      const berjalan = r.json?.data?.laporan?.find((l: any) => l.pekanBerjalan);
      laporanId = berjalan?.id ?? "";
      check(
        "bootstrap membuat Draf pekan berjalan",
        r.status === 200 && berjalan?.status === "Draf" && berjalan?.total === 1,
        `status=${r.status} laporan=${laporanId} total=${berjalan?.total ?? "-"}`,
      );
    }
    {
      const r = await sup.call("/api/pekan/bootstrap", { method: "POST" });
      const jumlahDraf = (r.json?.data?.laporan ?? []).filter(
        (l: any) => l.pekanBerjalan && l.status === "Draf",
      ).length;
      check("bootstrap idempoten", r.status === 200 && jumlahDraf === 1, `status=${r.status} draf=${jumlahDraf}`);
    }

    const baca = await sup.call(`/api/laporan/${laporanId}`);
    const baris = baca.json?.data?.baris?.[0];
    check(
      "GET laporan pemilik",
      baca.status === 200 && baris?.anggotaId === idAnak && baris?.kehadiran === null,
      `status=${baca.status} anggota=${baris?.anggotaId ?? "-"}`,
    );
    {
      const r = await atasan.call(`/api/laporan/${laporanId}`);
      check(
        "atasan boleh membaca laporan anak buahnya",
        r.status === 200 && r.json?.data?.bolehKoreksi === false,
        `status=${r.status} bolehKoreksi=${r.json?.data?.bolehKoreksi ?? "-"}`,
      );
    }
    {
      const r = await lain.call(`/api/laporan/${laporanId}`);
      check(
        "IDOR: orang lain → 404 NOT_FOUND",
        r.status === 404 && kode(r.json) === "NOT_FOUND",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/baris/${uuidDari("bukan-anggota")}`, {
        method: "PATCH",
        body: JSON.stringify({ kehadiran: "Tepat Waktu" }),
      });
      check(
        "PATCH anggota di luar laporan → 404",
        r.status === 404 && kode(r.json) === "NOT_FOUND",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({ kehadiran: "Datang Telat" }),
      });
      check(
        "PATCH status kehadiran di luar himpunan → 400 VALIDATION",
        r.status === 400 && kode(r.json) === "VALIDATION",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanId}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({ kehadiran: "Tepat Waktu" }),
      });
      check(
        "atasan tidak boleh mengubah (hanya koreksi) → 403",
        r.status === 403 && kode(r.json) === "FORBIDDEN",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({ kehadiran: "Tepat Waktu", mediaOnline: 4 }),
      });
      check(
        "PATCH sebagian tersimpan",
        r.status === 200 && r.json?.data?.barisLengkap === false,
        `status=${r.status} lengkap=${r.json?.data?.barisLengkap ?? "-"}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/submit`, { method: "POST" });
      check(
        "submit saat nilai kosong → 400 VALIDATION",
        r.status === 400 && kode(r.json) === "VALIDATION",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({
          kehadiran: "Terlambat < 15 Menit",
          keteranganHadir: "Banjir di jalan",
          mediaOnline: 4,
          mediaOffline: 0,
          oneOnOne: "Alpa",
        }),
      });
      check(
        "PATCH melengkapi baris",
        r.status === 200 && r.json?.data?.barisLengkap === true,
        `status=${r.status} lengkap=${r.json?.data?.barisLengkap ?? "-"}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/submit`, { method: "POST" });
      check(
        "submit lengkap → Terkirim",
        r.status === 200 && r.json?.data?.status === "Terkirim",
        `status=${r.status} status=${r.json?.data?.status ?? "-"}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({ mediaOnline: 9 }),
      });
      check(
        "ubah setelah submit → 403",
        r.status === 403 && kode(r.json) === "FORBIDDEN",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanId}/submit`, { method: "POST" });
      check("submit ulang → 403", r.status === 403, `status=${r.status} code=${kode(r.json)}`);
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanId}/koreksi`, {
        method: "POST",
        body: JSON.stringify({ alasan: "" }),
      });
      check(
        "koreksi tanpa alasan → 400 VALIDATION",
        r.status === 400 && kode(r.json) === "VALIDATION",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await lain.call(`/api/laporan/${laporanId}/koreksi`, {
        method: "POST",
        body: JSON.stringify({ alasan: "Bukan hak saya", baris: [{ anggotaId: idAnak }] }),
      });
      check(
        "koreksi oleh non-atasan → 404",
        r.status === 404 && kode(r.json) === "NOT_FOUND",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanId}/koreksi`, {
        method: "POST",
        body: JSON.stringify({
          alasan: "Pekan belum berakhir",
          baris: [{ anggotaId: idAnak, mediaOnline: 5 }],
        }),
      });
      check(
        "koreksi pekan berjalan → 403",
        r.status === 403 && kode(r.json) === "FORBIDDEN",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }

    // Laporan pekan lampau (disiapkan langsung di DB: sudah Terkirim).
    let laporanLampau = "";
    {
      const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
      await client.connect();
      try {
        const mulai = mulaiPekan(-1);
        const selesai = tambahHari(mulai, 6);
        const p = await client.query(
          `INSERT INTO pekan (mulai, selesai) VALUES ($1, $2)
           ON CONFLICT (mulai) DO UPDATE SET selesai = EXCLUDED.selesai RETURNING id`,
          [mulai, selesai],
        );
        idPekan = p.rows[0].id;
        const l = await client.query(
          `INSERT INTO laporan_pekan (pekan_id, supervisor_id, status, submitted_at)
           VALUES ($1, $2, 'Terkirim', now()) RETURNING id`,
          [idPekan, idSup],
        );
        laporanLampau = l.rows[0].id;
        await client.query(
          `INSERT INTO laporan_anggota (laporan_id, anggota_id, kehadiran, media_online, media_offline, one_on_one)
           VALUES ($1, $2, 'Tepat Waktu', 3, 1, 'Pribadi')`,
          [laporanLampau, idAnak],
        );
      } finally {
        await client.end();
      }
    }
    {
      const r = await sup.call(`/api/laporan/${laporanLampau}/baris/${idAnak}`, {
        method: "PATCH",
        body: JSON.stringify({ mediaOnline: 10 }),
      });
      check(
        "pemilik ubah laporan pekan lampau → 403",
        r.status === 403 && kode(r.json) === "FORBIDDEN",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanLampau}`);
      check(
        "atasan boleh koreksi laporan lampau",
        r.status === 200 && r.json?.data?.bolehKoreksi === true,
        `status=${r.status} bolehKoreksi=${r.json?.data?.bolehKoreksi ?? "-"}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanLampau}/koreksi`, {
        method: "POST",
        body: JSON.stringify({
          alasan: "Salah hitung sebar media online",
          baris: [{ anggotaId: idAnak, mediaOnline: 6 }],
        }),
      });
      check(
        "koreksi lampau → Dikoreksi",
        r.status === 200 && r.json?.data?.status === "Dikoreksi",
        `status=${r.status} status=${r.json?.data?.status ?? "-"}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanLampau}`);
      const k = r.json?.data?.koreksi?.[0];
      check(
        "koreksi tersimpan: nilai sesudah + diff + alasan",
        r.json?.data?.baris?.[0]?.mediaOnline === 6 && k?.alasan === "Salah hitung sebar media online",
        `media=${r.json?.data?.baris?.[0]?.mediaOnline ?? "-"} alasan=${k?.alasan ?? "-"}`,
      );
    }
    {
      const r = await atasan.call(`/api/laporan/${laporanLampau}/koreksi`, {
        method: "POST",
        body: JSON.stringify({ alasan: "Tanpa perubahan", baris: [{ anggotaId: idAnak }] }),
      });
      check(
        "koreksi tanpa perubahan → 400 VALIDATION",
        r.status === 400 && kode(r.json) === "VALIDATION",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }
    {
      const r = await sup.call(`/api/laporan/${laporanLampau}/koreksi`, {
        method: "POST",
        body: JSON.stringify({ alasan: "Koreksi diri sendiri", baris: [{ anggotaId: idAnak, mediaOnline: 1 }] }),
      });
      check(
        "pemilik tidak boleh mengoreksi sendiri → 403",
        r.status === 403 && kode(r.json) === "FORBIDDEN",
        `status=${r.status} code=${kode(r.json)}`,
      );
    }

    // Catch-up: laporan pekan berjalan terhapus → bootstrap membuat ulang Draf.
    {
      const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
      await client.connect();
      // Hapus laporan Draf pekan berjalan milik supervisor (baris laporan_anggota ikut cascade).
      await client.query(
        `DELETE FROM laporan_pekan lp USING pekan p WHERE p.id = lp.pekan_id
         AND p.mulai = $1 AND lp.supervisor_id = $2`,
        [mulaiPekan(0), idSup],
      );
      await client.end();
      const r = await sup.call("/api/pekan/bootstrap", { method: "POST" });
      const berjalan = r.json?.data?.laporan?.find((l: any) => l.pekanBerjalan);
      check(
        "catch-up pekan berjalan membuat Draf baru",
        r.status === 200 && berjalan?.status === "Draf" && berjalan?.id !== laporanId,
        `status=${r.status} laporan=${berjalan?.id ?? "-"}`,
      );
    }

    // Supervisor baru tanpa registri laporan: pekan lampau tidak diisi dulu.
    {
      await admin.call("/api/admin/karyawan", {
        method: "POST",
        body: JSON.stringify({
          nama: "Smoke Masa Depan",
          email: emailMasaDepan,
          password: passwordAwal,
          level: "Tetap",
          supervisorId: idSup,
        }),
      });
      const masaDepan = buatJar();
      await masuk(masaDepan, emailMasaDepan, passwordAwal);
      await masaDepan.call("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: passwordAwal, newPassword: passwordBaru }),
      });
      const r = await masaDepan.call("/api/pekan/bootstrap", { method: "POST" });
      check(
        "supervisor tanpa anggota: hanya pekan berjalan yang disiapkan",
        r.status === 200 && r.json?.data?.laporan?.length === 0 && r.json?.data?.anggotaLangsung === 0,
        `status=${r.status} laporan=${r.json?.data?.laporan?.length ?? "-"}`,
      );
    }
  }
}

async function cariIdKaryawan(email: string): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT k.id FROM karyawan k JOIN "user" u ON u.id = k.user_id WHERE u.email = $1`,
      [email],
    );
    return r.rows[0]?.id ?? "";
  } finally {
    await client.end();
  }
}

async function faseKlienIuran() {
  // Klien, follow-up, rekap, dan iuran (Commit 4) lewat rantai fase laporan:
  // atasan → supervisor → anggota (emailPertama).
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.log("SKIP  fase klien/iuran (DATABASE_URL_UNPOOLED tidak ada)");
    return;
  }
  if (!idSup || !idAnak) {
    console.log("SKIP  fase klien/iuran (supervisor/anggota tidak tersedia)");
    return;
  }

  let klienId = "";
  {
    const r = await sup.call("/api/klien", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Klien", kontak: "" }),
    });
    klienId = r.json?.data?.id ?? "";
    check(
      "supervisor buat klien (kontak kosong → null)",
      r.status === 201 && r.json?.data?.kontak === null,
      `status=${r.status} code=${kode(r.json)}`,
    );
  }

  const sesiAdmin = await admin.call("/api/auth/get-session");
  const adminAsli = sesiAdmin.json?.user?.email === adminEmail;
  let hasilId = "";
  let nominalId = "";
  if (adminAsli) {
    const h = await admin.call("/api/hasil-followup", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Tertarik", urutan: 1 }),
    });
    hasilId = h.json?.data?.id ?? "";
    check("admin tambah hasil follow-up", h.status === 201, `status=${h.status}`);
    const n = await admin.call("/api/nominal-iuran", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Nominal", nominal: 1000 }),
    });
    nominalId = n.json?.data?.id ?? "";
    check("admin tambah nominal iuran", n.status === 201, `status=${n.status}`);
    const o = await admin.call("/api/hasil-followup", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Nonaktif", urutan: 2 }),
    });
    if (o.status === 201) {
      // Master nonaktif untuk uji hasil_followup_id tidak aktif.
      const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
      await client.connect();
      await client.query(`UPDATE hasil_followup SET aktif = false WHERE id = $1`, [o.json.data.id]);
      await client.end();
    }
  }
  {
    const r = await sup.call("/api/hasil-followup");
    const r2 = await sup.call("/api/nominal-iuran");
    check(
      "GET master hasil follow-up & nominal iuran",
      r.status === 200 && (r.json?.data ?? []).length > 0 && r2.status === 200,
      `status=${r.status}/${r2.status}`,
    );
    hasilId ||= (r.json?.data ?? []).find((h: any) => h.aktif)?.id ?? "";
    nominalId ||= (r2.json?.data ?? []).find((n: any) => n.aktif)?.id ?? "";
    check(
      "master untuk uji tersedia (hasil & nominal)",
      hasilId !== "" && nominalId !== "",
      `hasil=${hasilId !== ""} nominal=${nominalId !== ""}`,
    );
  }
  {
    const r = await sup.call("/api/hasil-followup", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Bukan Admin" }),
    });
    const r2 = await sup.call("/api/nominal-iuran", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Bukan Admin", nominal: 1 }),
    });
    check(
      "angka master hanya Admin → 403",
      r.status === 403 && r2.status === 403,
      `status=${r.status}/${r2.status}`,
    );
  }

  {
    const r = await sup.call(`/api/klien/${klienId}/followup`, {
      method: "POST",
      body: JSON.stringify({ tanggal: tambahHari(tanggalWIB(0), 1), hasilFollowupId: hasilId }),
    });
    check(
      "follow-up tanggal besok → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await atasan.call(`/api/klien/${klienId}/followup`, {
      method: "POST",
      body: JSON.stringify({ tanggal: tanggalWIB(0), hasilFollowupId: hasilId }),
    });
    check(
      "follow-up oleh non-pemilik → 404",
      r.status === 404 && kode(r.json) === "NOT_FOUND",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await sup.call(`/api/klien/${klienId}/followup`, {
      method: "POST",
      body: JSON.stringify({ tanggal: tanggalWIB(0), hasilFollowupId: hasilId, deskripsi: "Tertarik" }),
    });
    check("catat follow-up", r.status === 201, `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const r = await sup.call(`/api/klien/${klienId}/followup`);
    const r2 = await atasan.call(`/api/klien/${klienId}/followup`);
    const r3 = await lain.call(`/api/klien/${klienId}/followup`);
    check(
      "riwayat: pemilik & atasan langsung boleh, orang lain 404",
      r.status === 200 && r.json?.data?.length === 1 && r2.status === 200 && r2.json?.data?.length === 1 && r3.status === 404,
      `status=${r.status}/${r2.status}/${r3.status}`,
    );
  }

  // Rekap pekan: follow-up dihitung dari kejadian, bukan angka manual.
  // Laporan pekan lampau (Terkirim) dipakai agar baris pekan berjalan yang
  // berstatus Draf tidak ikut dan hasilnya deterministik.
  {
    // -2 karena pekan -1 sudah dipakai fase laporan.
    const mulaiLampau = mulaiPekan(-2);
    const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED! });
    await client.connect();
    let pekanLampau = "";
    try {
      const p = await client.query(
        `INSERT INTO pekan (mulai, selesai) VALUES ($1, $2)
         ON CONFLICT (mulai) DO UPDATE SET selesai = EXCLUDED.selesai RETURNING id`,
        [mulaiLampau, tambahHari(mulaiLampau, 6)],
      );
      pekanLampau = p.rows[0].id;
      const l = await client.query(
        `INSERT INTO laporan_pekan (pekan_id, supervisor_id, status, submitted_at)
         VALUES ($1, $2, 'Terkirim', now()) RETURNING id`,
        [pekanLampau, idSup],
      );
      await client.query(
        `INSERT INTO laporan_anggota (laporan_id, anggota_id, kehadiran, media_online, media_offline, one_on_one)
         VALUES ($1, $2, 'Tepat Waktu', 3, 1, 'Pribadi')`,
        [l.rows[0].id, idAnak],
      );
    } finally {
      await client.end();
    }
    const rekap = await sup.call(`/api/rekap/pekan/${pekanLampau}`);
    const baris = rekap.json?.data?.baris ?? [];
    const r2 = await atasan.call(`/api/rekap/pekan/${pekanLampau}`);
    const r3 = await lain.call(`/api/rekap/pekan/${pekanLampau}`);
    check(
      "rekap pekan lampau: satu baris, follow-up dihitung dari kejadian",
      rekap.status === 200 && baris.length === 1 && baris[0]?.followup === 0,
      `status=${rekap.status} n=${baris.length} followup=${baris[0]?.followup ?? "-"}`,
    );
    check("rekap: atasan langsung boleh, orang lain 404", r2.status === 200 && r3.status === 404, `status=${r2.status}/${r3.status}`);
  }
  const bulanIni = `${tanggalWIB(0).slice(0, 7)}-01`;
  {
    const r = await sup.call("/api/pembayaran-iuran", {
      method: "POST",
      body: JSON.stringify({ karyawanId: idAnak, nominalIuranId: nominalId, bulan: bulanIni }),
    });
    check(
      "supervisor langsung mencatat iuran anggota",
      r.status === 201 && r.json?.data?.dicatatUntukOrangLain === true,
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await sup.call("/api/pembayaran-iuran", {
      method: "POST",
      body: JSON.stringify({ karyawanId: idAnak, nominalIuranId: nominalId, bulan: bulanIni }),
    });
    check(
      "duplikat (karyawan, bulan) → 409",
      r.status === 409 && kode(r.json) === "CONFLICT",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await atasan.call("/api/pembayaran-iuran", {
      method: "POST",
      body: JSON.stringify({ karyawanId: idAnak, nominalIuranId: nominalId, bulan: bulanIni }),
    });
    check(
      "supervisor tidak langsung mencatat → 403",
      r.status === 403 && kode(r.json) === "FORBIDDEN",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await anggota.call("/api/pembayaran-iuran", {
      method: "POST",
      body: JSON.stringify({ nominalIuranId: nominalId, bulan: bulanDepan(bulanIni) }),
    });
    check(
      "iuran bulan depan → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await sup.call("/api/pembayaran-iuran");
    const data = r.json?.data ?? [];
    check(
      "GET iuran: saw pembayaran Anggota Langsung",
      r.status === 200 && data.some((p: any) => p.karyawan?.id === idAnak && p.olehSupervisor === true),
      `status=${r.status} n=${data.length}`,
    );
    const r2 = await lain.call(`/api/pembayaran-iuran?karyawanId=${idAnak}`);
    check(
      "IDOR: iuran karyawan lain → 404",
      r2.status === 404 && kode(r2.json) === "NOT_FOUND",
      `status=${r2.status} code=${kode(r2.json)}`,
    );
  }

  // Nonaktif ditolak VALIDATION (bukan 401/403): superv masih punya Anggota & Klien.
  {
    const r = await admin.call(`/api/admin/karyawan/${idSup}`, {
      method: "PATCH",
      body: JSON.stringify({ aktif: false }),
    });
    check(
      "nonaktif ditolak karena beban → 400 VALIDATION",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)} body=${r.text.slice(0, 120)}`,
    );
  }
}

async function faseAdminKepegawaian() {
  // PATCH admin/karyawan: siklus, pindah supervisor, demote, nonaktif, alih klien.
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.log("SKIP  fase admin kepegawaian (DATABASE_URL_UNPOOLED tidak ada)");
    return;
  }
  const sesi = await admin.call("/api/auth/get-session");
  const profilAdmin = await admin.call("/api/me");
  if (sesi.json?.user?.email !== adminEmail || profilAdmin.json?.data?.role !== "admin") {
    console.log("SKIP  fase admin kepegawaian (admin bukan ADMIN_EMAIL; data seed?)");
    return;
  }

  // Rantai baru: X (puncak) ← Y ← Z.
  const emailX = `smoke-x-${stempel}@seed.local`;
  const emailY = `smoke-y-${stempel}@seed.local`;
  const emailZ = `smoke-z-${stempel}@seed.local`;
  const idr: Record<string, string> = {};
  for (const [email, nama] of [
    [emailX, "Smoke Atas"],
    [emailY, "Smoke Tengah"],
    [emailZ, "Smoke Bawah"],
  ] as const) {
    const r = await admin.call("/api/admin/karyawan", {
      method: "POST",
      body: JSON.stringify({ nama, email, password: passwordAwal, level: "Tetap" }),
    });
    check(`admin buat ${nama}`, r.status === 201, `status=${r.status} code=${kode(r.json)}`);
    idr[email] = await cariIdKaryawan(email);
  }
  // Satu sesi untuk ketiga akun: token sesi berbagi nama dengan sesi admin, dan
  // PATCH nonaktif mencabut semua sesi akun itu — sesi terpisah akan saling
  // menimpa di header Cookie.
  const bersama = buatJar();
  let sesiAktif = "";
  async function jadi(email: string) {
    const r = await masuk(bersama, email, sesiAktif === email ? passwordBaru : passwordAwal);
    if (sesiAktif === email) return r;
    const ganti = await bersama.call("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: passwordAwal, newPassword: passwordBaru }),
    });
    if (r.status === 200 && ganti.status === 200) sesiAktif = email;
    return ganti;
  }
  for (const email of [emailZ, emailY, emailX]) await jadi(email);
  const kembaliKeZ = () => jadi(emailZ);
  const patch = (email: string, body: unknown) =>
    admin.call(`/api/admin/karyawan/${idr[email]}`, { method: "PATCH", body: JSON.stringify(body) });
  // Token sesi Better Auth berotasi saat dipakai. Membaca sesi dengan jar lain
  // setelah PATCH dapat menimpa token di DB sebelum jar admin membaca respons
  // PATCH (get-session tampak valid, PATCH 401). Jadi sediakan jalur PATCH yang
  // memakai jar bersama: ubah namamu sendiri lewat akun yang sedang aktif.
  async function patchSebagaiEmail(email: string) {
    await jadi(email);
    const r = await bersama.call(`/api/admin/karyawan/${idr[email]}`, {
      method: "PATCH",
      body: JSON.stringify({ nama: "Smoke Bawah" }),
    });
    if (r.status !== 200) throw new Error(`PATCH ${email} gagal: ${r.status} ${r.text.slice(0, 120)}`);
  }

  {
    await jadi(emailY);
    const r = await bersama.call("/api/admin/karyawan");
    await kembaliKeZ();
    const r2 = await bersama.call(`/api/admin/karyawan/${idr[emailY]}`, {
      method: "PATCH",
      body: JSON.stringify({ nama: "Dibajak" }),
    });
    check("non-admin akses admin → 403", r.status === 403 && r2.status === 403, `status=${r.status}/${r2.status}`);
  }
  {
    const r = await patch(emailZ, { supervisorId: idr[emailY]! });
    check("pindah supervisor: Z di bawah Y", r.status === 200 && r.json?.data?.supervisorId === idr[emailY], `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const r = await patch(emailY, { supervisorId: idr[emailX]! });
    check("pindah supervisor: Y di bawah X", r.status === 200, `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const r = await patch(emailX, { supervisorId: idr[emailZ]! });
    check(
      "supervisor membentuk siklus → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await patch(emailY, { level: "Magang" });
    check("demote Tetap→Magang yang membimbing Magang → 400", r.status === 400 && kode(r.json) === "VALIDATION", `status=${r.status} code=${kode(r.json)}`);
  }
  {
    // Y tidak boleh dinonaktifkan sebelum Z selesai diuji: kegagalan lebih awal
    // tidak boleh menyamarkan uji nonaktif Z.
    await patchSebagaiEmail(emailZ);
    const r = await patch(emailY, { supervisorId: idr[emailZ]! });
    check(
      "supervisor = Anggota Langsung (siklus) → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
    await jadi(emailX);
    // Kembalikan rantai: siklus ditolak sebelum menulis, Y tetap puncak.
    const balik = await patch(emailY, { supervisorId: idr[emailX]! });
    check("Y kembali di bawah X", balik.status === 200, `status=${balik.status} code=${kode(balik.json)}`);
  }

  // Draf pekan berjalan Y berisi baris Z (setelah pindah supervisor).
  {
    await jadi(emailY);
    const r = await bersama.call("/api/pekan/bootstrap", { method: "POST" });
    const berjalan = r.json?.data?.laporan?.find((l: any) => l.pekanBerjalan);
    check(
      "Draf Y memuat baris Z setelah pindah supervisor",
      r.status === 200 && berjalan?.total === 1,
      `status=${r.status} total=${berjalan?.total ?? "-"}`,
    );
  }

  let klienZ = "";
  {
    await kembaliKeZ();
    const r = await bersama.call("/api/klien", {
      method: "POST",
      body: JSON.stringify({ nama: "Smoke Klien Z", kontak: "0800" }),
    });
    klienZ = r.json?.data?.id ?? "";
    check("Z buat klien", r.status === 201, `status=${r.status}`);
  }
  {
    const r = await patch(emailZ, { aktif: false });
    check(
      "nonaktif dengan klien → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await patch(emailY, { aktif: false });
    check("nonaktif supervisor yang punya anggota → 400", r.status === 400, `status=${r.status} body=${r.text.slice(0, 120)}`);
  }
  {
    await jadi(emailY);
    const r = await bersama.call(`/api/klien/${klienZ}/alih`, {
      method: "POST",
      body: JSON.stringify({ keKaryawanId: idr[emailX] }),
    });
    check("alih klien oleh non-admin → 403", r.status === 403, `status=${r.status}`);
  }
  {
    const r = await admin.call(`/api/klien/${klienZ}/alih`, {
      method: "POST",
      body: JSON.stringify({ keKaryawanId: idr[emailZ] }),
    });
    check(
      "alih ke pemilik yang sama → 400",
      r.status === 400 && kode(r.json) === "VALIDATION",
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    const r = await admin.call(`/api/klien/${klienZ}/alih`, {
      method: "POST",
      body: JSON.stringify({ keKaryawanId: idr[emailY] }),
    });
    check(
      "alih klien oleh admin",
      r.status === 200 && r.json?.data?.pemilik?.id === idr[emailY],
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
  {
    check(
      "sesi admin masih berlaku sebelum nonaktif",
      await sesiAdminMasihBerjalan(),
      "sesi admin hilang",
    );
    const r = await patch(emailZ, { aktif: false });
    check(
      "nonaktif anggota tanpa klien → 200 + sesi dicabut",
      r.status === 200 && r.json?.data?.aktif === false && r.json?.data?.sesiDicabut === true,
      `status=${r.status} body=${r.text.slice(0, 160)}`,
    );
  }
  {
    await kembaliKeZ();
    const r = await bersama.call("/api/me");
    check("sesi karyawan nonaktif tidak berlaku", r.status === 401, `status=${r.status} code=${kode(r.json)}`);
  }
  {
    const r = await bersama.call(`/api/pembayaran-iuran`);
    check("tidak bisa mencatat iuran setelah nonaktif → 401", r.status === 401, `status=${r.status}`);
  }
  {
    const r = await patch(emailY, { aktif: false });
    check(
      "nonaktif supervisor yang kliennya sudah dialihkan → 200",
      r.status === 200 && r.json?.data?.aktif === false,
      `status=${r.status} code=${kode(r.json)}`,
    );
  }
}

let kandidatAdmin = [...new Set([passwordAdminAktif, adminPasswordBaru])];
let admin = await masukAdmin();

async function sesiAdminMasihBerjalan() {
  const r = await admin.call("/api/auth/get-session");
  return r.json?.user?.email === adminEmail;
}

// Better Auth melimit login per IP (10/menit di /sign-in/email); pantau dan
// tunggu bila server menolak dengan 429 sebelum skenario berikutnya.
async function tungguBilaDibatasi() {
  for (let i = 0; i < 12; i += 1) {
    const r = await masuk(buatJar(), adminEmail!, passwordSesiAdmin || adminPasswordBaru);
    if (r.status !== 429) {
      if (i > 0) console.log("INFO  rate limit login selesai, melanjutkan");
      return;
    }
    console.log("INFO  rate limit login (429), menunggu 10 detik...");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

try {
  await jalankanFase();
  if (!(await sesiAdminMasihBerjalan())) {
    await tungguBilaDibatasi();
    admin = await masukAdmin();
  }
  await faseLaporan();
  await faseKlienIuran();
  await faseAdminKepegawaian();
} finally {
  // Bersihkan data uji dalam satu transaksi, urutan mengikuti FK RESTRICT:
  // koreksi → laporan → followup → iuran → klien → karyawan → user, lalu master "Smoke ".
  // Satu transaksi: bila satu langkah gagal, tidak ada yang terhapus separuh.
  if (process.env.DATABASE_URL_UNPOOLED) {
    const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await client.connect();
    const karyawanSmoke = `(SELECT k.id FROM karyawan k JOIN "user" u ON u.id = k.user_id
       WHERE u.email LIKE 'smoke-%@seed.local')`;
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM koreksi_laporan WHERE laporan_id IN (
           SELECT l.id FROM laporan_pekan l WHERE l.supervisor_id IN ${karyawanSmoke})`,
      );
      await client.query(`DELETE FROM laporan_pekan WHERE supervisor_id IN ${karyawanSmoke}`);
      // Follow-up hasil fase ini dibuat oleh karyawan smoke.
      await client.query(`DELETE FROM followup WHERE created_by IN ${karyawanSmoke}`);
      await client.query(`DELETE FROM pembayaran_iuran WHERE karyawan_id IN ${karyawanSmoke}`);
      await client.query(`DELETE FROM klien WHERE karyawan_id IN ${karyawanSmoke}`);
      const hasil = await client.query(
        `WITH profil AS (
           DELETE FROM karyawan ks USING "user" u
           WHERE ks.user_id = u.id AND u.email LIKE 'smoke-%@seed.local'
           RETURNING u.id
         ), akun AS (
           DELETE FROM "user" WHERE id IN (SELECT id FROM profil) RETURNING id
         ) SELECT count(*)::int AS n FROM akun`,
      );
      await client.query(`DELETE FROM nominal_iuran WHERE nama LIKE 'Smoke %'`);
      await client.query(`DELETE FROM hasil_followup WHERE nama LIKE 'Smoke %'`);
      await client.query("COMMIT");
      console.log(`smoke: ${hasil.rows[0].n} data uji dibersihkan.`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
    await client.end();
    // Data @seed.local tidak disentuh smoke; seed.mts --cleanup untuk menghapusnya.
    console.log("smoke: data @seed.local tidak disentuh (pk. seed.mts --cleanup).");
  } else {
    console.log(`smoke: DATABASE_URL_UNPOOLED tidak ada; bersihkan manual (${emailPertama}, ${emailKedua}).`);
  }
}
