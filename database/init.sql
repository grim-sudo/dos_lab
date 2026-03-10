-- ─────────────────────────────────────────────────────────────────────────────
-- TrackShop — Database initialisation + seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Schema ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(60)  NOT NULL UNIQUE,
    password   VARCHAR(128) NOT NULL,          -- plaintext for lab simplicity
    email      VARCHAR(120) NOT NULL UNIQUE,
    role       VARCHAR(20)  NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    category    VARCHAR(60)  NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    stock       INT          NOT NULL DEFAULT 0,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Intentionally no index on name/description — forces full-table-scan searches
-- (In production you would use: CREATE INDEX ... USING gin(to_tsvector(...)))

CREATE TABLE IF NOT EXISTS orders (
    id         SERIAL PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(id),
    status     VARCHAR(30)   NOT NULL DEFAULT 'pending',
    total      NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT           NOT NULL REFERENCES products(id),
    quantity   INT           NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL
);

-- ── Seed: users ───────────────────────────────────────────────────────────────

INSERT INTO users (username, password, email, role) VALUES
  ('admin',       'admin123',    'admin@trackshop.local',    'admin'),
  ('alice',       'alice2024',   'alice@example.com',        'customer'),
  ('bob',         'password',    'bob@example.com',          'customer'),
  ('carol',       'carol99',     'carol@example.com',        'customer'),
  ('dave',        'letmein',     'dave@example.com',         'customer'),
  ('eve',         'eve2024',     'eve@example.com',          'customer'),
  ('frank',       'frank007',    'frank@example.com',        'customer'),
  ('grace',       'grace2024',   'grace@example.com',        'customer'),
  ('heidi',       'heidi123',    'heidi@example.com',        'customer'),
  ('ivan',        'ivan2024',    'ivan@example.com',         'customer'),
  ('judy',        'judy2024',    'judy@example.com',         'customer'),
  ('mallory',     'mallory!',    'mallory@example.com',      'customer'),
  ('oscar',       'oscar2024',   'oscar@example.com',        'customer'),
  ('peggy',       'peggy2024',   'peggy@example.com',        'customer'),
  ('trent',       'trent2024',   'trent@example.com',        'customer')
ON CONFLICT DO NOTHING;

-- ── Seed: products ────────────────────────────────────────────────────────────

INSERT INTO products (name, category, price, stock, description) VALUES
  ('Wireless Noise-Cancelling Headphones', 'Electronics',  149.99, 120,
   'Over-ear headphones with 30h battery, Bluetooth 5.2, active noise cancellation and built-in mic.'),
  ('USB-C Laptop Hub 7-in-1',             'Electronics',   49.99, 300,
   'Expands one USB-C port into HDMI 4K, 3×USB-A, SD card, microSD and 100W PD charging.'),
  ('Mechanical Keyboard TKL RGB',         'Electronics',  129.99,  80,
   'Tenkeyless mechanical keyboard with Cherry MX Red switches, per-key RGB and aluminium frame.'),
  ('Ergonomic Office Chair',              'Furniture',    349.99,  40,
   'Adjustable lumbar support, breathable mesh back, 4D armrests, 5-year warranty.'),
  ('Standing Desk 140×70cm',             'Furniture',    499.99,  25,
   'Electric height-adjustable desk, dual motor, memory presets, cable management tray.'),
  ('Monitor 27" 4K IPS 144Hz',           'Electronics',  599.99,  60,
   'Factory-calibrated IPS panel, Delta-E<2, 99% sRGB, FreeSync Premium, USB-C 65W.'),
  ('Webcam 4K Auto-Focus',               'Electronics',   89.99, 200,
   'Sony sensor, HDR, privacy shutter, built-in stereo mic, works with Teams and Zoom.'),
  ('LED Desk Lamp with Wireless Charger', 'Accessories',   39.99, 400,
   'Touch-dimming, 5 colour temperatures, USB-A charging port and 10W Qi wireless pad.'),
  ('Cable Management Kit 50-piece',      'Accessories',   14.99, 800,
   'Velcro ties, adhesive clips, cable sleeves and desk grommets for tidy workspaces.'),
  ('Laptop Stand Adjustable Aluminium',  'Accessories',   34.99, 350,
   'Six height settings, foldable, heat-dissipating aluminium for laptops up to 17".'),
  ('Noise-Cancelling Earbuds Pro',       'Electronics',   99.99, 180,
   'ANC earbuds, IPX5, 8h playback, wireless charging case, multipoint Bluetooth.'),
  ('Smart Plug 4-pack WiFi',             'Smart Home',    29.99, 500,
   'Voice control via Alexa/Google, energy monitoring, timer and away mode.'),
  ('Indoor Security Camera 2K',          'Smart Home',    49.99, 220,
   '2K resolution, night vision, two-way audio, local + cloud storage, motion zones.'),
  ('Smart Door Lock Fingerprint',        'Smart Home',   129.99,  90,
   'Fingerprint, PIN, app and key access, auto-lock, tamper alert, fits most doors.'),
  ('Robot Vacuum & Mop Combo',           'Smart Home',   299.99,  55,
   'LiDAR mapping, carpet boost, mop module, app scheduling, works with Alexa.'),
  ('Portable SSD 1TB USB-C',             'Storage',       89.99, 260,
   '1050 MB/s read, shock-resistant, bus-powered, compatible with PS5 extended storage.'),
  ('NAS Drive 4TB Desktop',              'Storage',      129.99,  70,
   '2-bay desktop NAS drive for home backups, RAID 1 support, gigabit ethernet.'),
  ('Gaming Mouse 25600 DPI',             'Peripherals',   69.99, 160,
   'Optical sensor, 6 programmable buttons, per-profile onboard memory, braided cable.'),
  ('Mouse Pad XL 90×40cm',              'Peripherals',   19.99, 700,
   'Smooth surface, anti-slip rubber base, stitched edges, easy to clean.'),
  ('HDMI 2.1 Cable 2m',                 'Accessories',    9.99, 1200,
   'Supports 8K@60 and 4K@120, Dynamic HDR, bandwidth 48Gbps, gold-plated connectors.'),
  ('USB-C Fast Charger 65W GaN',        'Accessories',   29.99, 550,
   'GaN III technology, charges laptop + phone simultaneously, foldable plug, compact.'),
  ('Wireless Charging Pad 15W',         'Accessories',   19.99, 480,
   'MagSafe compatible, 15W for iPhone, 12W for Android, LED indicator, non-slip pad.'),
  ('Blue Light Blocking Glasses',       'Accessories',   24.99, 600,
   'Anti-glare, UV400, TR90 lightweight frames, reduces digital eye strain.'),
  ('Green Screen 150×200cm',            'Accessories',   39.99, 140,
   'Chromakey fabric, wrinkle-resistant, includes 2 spring clamps and carry bag.'),
  ('Condenser Microphone USB',          'Audio',          79.99, 130,
   'Cardioid polar pattern, 192kHz/24-bit, metal body, adjustable scissor arm included.')
ON CONFLICT DO NOTHING;

-- ── Seed: orders + items (generates ~500 orders spanning 90 days) ─────────────

DO $$
DECLARE
  i           INT;
  v_user_id   INT;
  v_order_id  INT;
  v_created   TIMESTAMPTZ;
  v_items     INT;
  j           INT;
  v_product   INT;
  v_qty       INT;
  v_price     NUMERIC(10,2);
  v_total     NUMERIC(10,2);
  v_status    VARCHAR(30);
  statuses    TEXT[] := ARRAY['completed','completed','completed','processing','pending','cancelled'];
BEGIN
  FOR i IN 1..500 LOOP
    v_user_id := (SELECT id FROM users ORDER BY RANDOM() LIMIT 1);
    v_created := NOW() - (RANDOM() * INTERVAL '90 days');
    v_status  := statuses[ 1 + FLOOR(RANDOM() * ARRAY_LENGTH(statuses,1))::INT ];
    v_total   := 0;

    INSERT INTO orders (user_id, status, total, created_at)
    VALUES (v_user_id, v_status, 0, v_created)
    RETURNING id INTO v_order_id;

    v_items := 1 + FLOOR(RANDOM() * 5)::INT;

    FOR j IN 1..v_items LOOP
      SELECT id, price INTO v_product, v_price
        FROM products ORDER BY RANDOM() LIMIT 1;

      v_qty   := 1 + FLOOR(RANDOM() * 4)::INT;
      v_total := v_total + (v_price * v_qty);

      INSERT INTO order_items (order_id, product_id, quantity, unit_price)
      VALUES (v_order_id, v_product, v_qty, v_price);
    END LOOP;

    UPDATE orders SET total = v_total WHERE id = v_order_id;
  END LOOP;
END;
$$;
