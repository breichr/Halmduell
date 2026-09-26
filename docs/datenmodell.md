# Datenmodell: Halmduell

Referenz-Schema in SQL (die produktive Umsetzung liegt als Drizzle-ORM-
Definition unter `apps/api/src/db/schema.ts`).

```sql
-- Nutzer
CREATE TABLE users (
    id INT PRIMARY KEY,
    username VARCHAR(50),
    created_at TIMESTAMP
);

-- Fragen-Pool
CREATE TABLE questions (
    id INT PRIMARY KEY,
    kategorie VARCHAR(20),        -- 'kulturen', 'schaedlinge', 'krankheiten', 'wissen'
    typ VARCHAR(10),               -- 'bild' oder 'text'
    frage_text TEXT,
    bild_url VARCHAR(255),         -- NULL bei reinen Wissensfragen
    bild_quelle VARCHAR(255),      -- Attribution (z. B. "Wikimedia Commons, CC-BY-SA, Autor XY")
    schwierigkeit SMALLINT,        -- 1-5
    erklaerung TEXT,               -- Feedback-Text nach Beantwortung
    status VARCHAR(20),            -- 'entwurf', 'eingereicht', 'freigegeben', 'abgelehnt'
    eingereicht_von INT REFERENCES users(id)
);

-- Antwortoptionen je Frage
CREATE TABLE answer_options (
    id INT PRIMARY KEY,
    question_id INT REFERENCES questions(id),
    text VARCHAR(100),
    ist_richtig BOOLEAN
);

-- Ein Duell zwischen zwei Spielern
CREATE TABLE duels (
    id INT PRIMARY KEY,
    spieler_a_id INT REFERENCES users(id),
    spieler_b_id INT REFERENCES users(id),
    kategorie VARCHAR(20),
    status VARCHAR(20),            -- 'wartet_a', 'wartet_b', 'abgeschlossen'
    erstellt_at TIMESTAMP,
    abgeschlossen_at TIMESTAMP
);

-- Die 6 Fragen, die zu einem Duell gehören (für beide Spieler identisch)
CREATE TABLE duel_questions (
    duel_id INT REFERENCES duels(id),
    question_id INT REFERENCES questions(id),
    reihenfolge SMALLINT,
    PRIMARY KEY (duel_id, reihenfolge)
);

-- Antworten je Spieler und Frage
CREATE TABLE duel_answers (
    duel_id INT REFERENCES duels(id),
    user_id INT REFERENCES users(id),
    question_id INT REFERENCES questions(id),
    answer_option_id INT REFERENCES answer_options(id),
    antwortzeit_ms INT,             -- für Zeitbonus
    ist_richtig BOOLEAN,
    PRIMARY KEY (duel_id, user_id, question_id)
);

-- Ratings (ELO), pro Kategorie und Saison getrennt
CREATE TABLE ratings (
    user_id INT REFERENCES users(id),
    kategorie VARCHAR(20),          -- 'gesamt', 'kulturen', 'schaedlinge', 'krankheiten'
    saison INT,
    rating INT DEFAULT 1000,
    duelle_gespielt INT DEFAULT 0,
    PRIMARY KEY (user_id, kategorie, saison)
);

-- Freundschaften
CREATE TABLE friendships (
    user_id INT REFERENCES users(id),
    friend_id INT REFERENCES users(id),
    status VARCHAR(20),      -- 'angefragt', 'bestaetigt'
    erstellt_at TIMESTAMP,
    PRIMARY KEY (user_id, friend_id)
);

-- Abzeichen
CREATE TABLE achievements (
    id INT PRIMARY KEY,
    key VARCHAR(50),        -- 'schaedling_experte', 'saison_top10'
    titel VARCHAR(100),
    beschreibung TEXT,
    icon VARCHAR(50)
);

CREATE TABLE user_achievements (
    user_id INT REFERENCES users(id),
    achievement_id INT REFERENCES achievements(id),
    erreicht_at TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);
```

## Ablauf im Zusammenspiel

1. Duell erstellen → `duels`-Zeile + 6 (zufällige oder kategoriegefilterte)
   Fragen in `duel_questions`.
2. Spieler A beantwortet → 6 Zeilen in `duel_answers`, Status wechselt zu
   `wartet_b`.
3. Spieler B beantwortet → weitere 6 Zeilen, Status wird `abgeschlossen`.
4. Bei Abschluss: Punkte summieren, ELO-Update-Funktion aufrufen,
   `ratings` aktualisieren.
5. Statistik-Screen liest `duel_answers` gruppiert nach `kategorie` (Join
   über `questions`) für die Trefferquote.
