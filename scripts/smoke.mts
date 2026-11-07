// Smoke HTTP terhadap aplikasi yang berjalan (`pnpm start`), tanpa impor modul auth.
// Fase auth (Commit 2). Data uji memakai prefix email `smoke-` dan dibersihkan
// di akhir lewat DB langsung. Jalankan serial: satu skenario setelah skenario lain.
import { Client } from "pg";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordBaru = process.env.SMOKE_ADMIN_PASSWORD_BARU ?? "AdminBaru123!";
const stempel = Date.now();
const emailPertama = `smoke-anggota-a-${stempel}@seed.local`;
const emailKedua = `smoke-anggota-b-${stempel}@seed.local`;
const passwordAwal = "SmokeAwal123!";
const passwordBaru = "SmokeBaru456!";

if (!adminPassword) {
  console.error("smoke: ADMIN_PASSWORD wajib diisi (jalankan dengan --env-file=.env.local).");
  process.exit(1);
}
// Password admin yang dipakai skrip (ganti-password mengubahnya di DB).
const passwordAdminAktif = process.env.SMOKE_ADMIN_PASSWORD ?? adminPassword;

function buatJar() {
  const jar = new Map<string, string>();
  function cookieHeader() {
    return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  function absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value === "" || /max-age=0/i.test(raw)) jar.delete(name);
      else jar.set(name, value);
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

const admin = buatJar();
const anggota = buatJar();

try {
  // 1. Login admin pertama (hasil seed-admin, masih wajib ganti password).
  {
    const r = await masuk(admin, adminEmail!, passwordAdminAktif);
    const sesi = await admin.call("/api/auth/get-session");
    check(
      "admin login",
      r.status === 200 && sesi.json?.user?.email === adminEmail,
      `status=${r.status} user=${sesi.json?.user?.email ?? "-"}`,
    );
  }

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

  // 4. Admin wajib ganti password dulu sebelum endpoint lain.
  {
    const r = await admin.call("/api/admin/karyawan", { method: "POST", body: "{}" });
    check(
      "admin wajib ganti password → 403 PASSWORD_CHANGE_REQUIRED",
      r.status === 403 && kode(r.json) === "PASSWORD_CHANGE_REQUIRED",
      `status=${r.status} code=${kode(r.json)}`,
    );

    const g = await admin.call("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: passwordAdminAktif,
        newPassword: adminPasswordBaru,
      }),
    });
    check("admin ganti password", g.status === 200, `status=${g.status} ${g.text.slice(0, 80)}`);

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
} finally {
  if (process.env.DATABASE_URL_UNPOOLED) {
    const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
    await client.connect();
    // karyawan.user_id ON DELETE RESTRICT: hapus profil dulu, akun & sesi ikut cascade.
    const hasil = await client.query(
      `WITH profil AS (
         DELETE FROM karyawan ks USING "user" u
         WHERE ks.user_id = u.id AND u.email LIKE 'smoke-%@seed.local'
         RETURNING u.id
       ), akun AS (
         DELETE FROM "user" WHERE id IN (SELECT id FROM profil) RETURNING id
       ) SELECT count(*)::int AS n FROM akun`,
    );
    await client.end();
    console.log(`smoke: ${hasil.rows[0].n} data uji dibersihkan.`);
  } else {
    console.log(`smoke: DATABASE_URL_UNPOOLED tidak ada; bersihkan manual (${emailPertama}, ${emailKedua}).`);
  }
}
