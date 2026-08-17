INSERT INTO kategori (nama) VALUES
  ('Alat tukang'),
  ('Alat teknik'),
  ('Power tools'),
  ('Listrik'),
  ('Rumah tangga'),
  ('Cat'),
  ('Mur Baut'),
  ('Kunci Pintu & Aksesoris Mebel'),
  ('Sanitary'),
  ('Perlengkapan Safety')
ON CONFLICT (nama) DO NOTHING;
