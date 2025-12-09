const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const dbPath = path.join(__dirname, 'prisma', 'smartpizzapp13-T3.db');
const db = new sqlite3.Database(dbPath);

const pizzas = [
    { nazwa: "Margherita", cena_mala: 20, cena_srednia: 25, cena_duza: 30 },
    { nazwa: "Pepperoni", cena_mala: 25, cena_srednia: 30, cena_duza: 35 },
    { nazwa: "Quattro Stagioni", cena_mala: 28, cena_srednia: 33, cena_duza: 38 },
    { nazwa: "Hawaiana", cena_mala: 26, cena_srednia: 31, cena_duza: 36 },
    { nazwa: "Vegetariana", cena_mala: 24, cena_srednia: 29, cena_duza: 34 },
    { nazwa: "Capriciosa", cena_mala: 27, cena_srednia: 32, cena_duza: 37 },
    { nazwa: "Quattro Formaggi", cena_mala: 29, cena_srednia: 34, cena_duza: 39 },
    { nazwa: "Salami", cena_mala: 25, cena_srednia: 30, cena_duza: 35 },
    { nazwa: "Prosciutto", cena_mala: 28, cena_srednia: 33, cena_duza: 38 },
    { nazwa: "Funghi", cena_mala: 23, cena_srednia: 28, cena_duza: 33 },
    { nazwa: "Marinara", cena_mala: 18, cena_srednia: 23, cena_duza: 28 },
    { nazwa: "Diavola", cena_mala: 26, cena_srednia: 31, cena_duza: 36 },
    { nazwa: "Tonno", cena_mala: 27, cena_srednia: 32, cena_duza: 37 },
    { nazwa: "Carbonara", cena_mala: 30, cena_srednia: 35, cena_duza: 40 },
    { nazwa: "Americana", cena_mala: 28, cena_srednia: 33, cena_duza: 38 },
    { nazwa: "Mexicana", cena_mala: 29, cena_srednia: 34, cena_duza: 39 },
    { nazwa: "BBQ", cena_mala: 31, cena_srednia: 36, cena_duza: 41 },
    { nazwa: "Seafood", cena_mala: 35, cena_srednia: 40, cena_duza: 45 },
    { nazwa: "Rustica", cena_mala: 27, cena_srednia: 32, cena_duza: 37 },
    { nazwa: "Calzone", cena_mala: 32, cena_srednia: 37, cena_duza: 42 },
    { nazwa: "Bianca", cena_mala: 24, cena_srednia: 29, cena_duza: 34 },
    { nazwa: "Spinaci", cena_mala: 26, cena_srednia: 31, cena_duza: 36 },
    { nazwa: "Rucola", cena_mala: 28, cena_srednia: 33, cena_duza: 38 },
    { nazwa: "Parmigiana", cena_mala: 30, cena_srednia: 35, cena_duza: 40 },
    { nazwa: "Gorgonzola", cena_mala: 29, cena_srednia: 34, cena_duza: 39 },
    { nazwa: "Siciliana", cena_mala: 31, cena_srednia: 36, cena_duza: 41 },
    { nazwa: "Napoletana", cena_mala: 22, cena_srednia: 27, cena_duza: 32 },
    { nazwa: "Romana", cena_mala: 25, cena_srednia: 30, cena_duza: 35 },
    { nazwa: "Focaccia", cena_mala: 20, cena_srednia: 25, cena_duza: 30 },
    { nazwa: "Bresaola", cena_mala: 33, cena_srednia: 38, cena_duza: 43 },
    { nazwa: "Caprese", cena_mala: 28, cena_srednia: 33, cena_duza: 38 },
    { nazwa: "Mortadella", cena_mala: 26, cena_srednia: 31, cena_duza: 36 },
    { nazwa: "Pancetta", cena_mala: 27, cena_srednia: 32, cena_duza: 37 },
    { nazwa: "Salmone", cena_mala: 34, cena_srednia: 39, cena_duza: 44 },
    { nazwa: "Verdure", cena_mala: 24, cena_srednia: 29, cena_duza: 34 },
    { nazwa: "Ortolana", cena_mala: 25, cena_srednia: 30, cena_duza: 35 },
    { nazwa: "Bufalina", cena_mala: 32, cena_srednia: 37, cena_duza: 42 },
    { nazwa: "Tartufata", cena_mala: 38, cena_srednia: 43, cena_duza: 48 },
    { nazwa: "Fiori Zucca", cena_mala: 30, cena_srednia: 35, cena_duza: 40 },
    { nazwa: "Provola", cena_mala: 29, cena_srednia: 34, cena_duza: 39 }
];

// Common ingredients mapping (guessed based on typical pizza compositions)
const ingredientsMap = {
    1: "Sos pomidorowy",
    2: "Ser Mozzarella",
    3: "Bazylia",
    4: "Szynka",
    5: "Pieczarki",
    6: "Cebula",
    7: "Papryka",
    8: "Salami",
    9: "Boczek",
    10: "Jajko",
    11: "Kukurydza",
    12: "Oliwki",
    13: "Ananas",
    14: "Kurczak",
    15: "Pomidor",
    16: "Rukola",
    17: "Parmezan",
    18: "Gorgonzola",
    19: "Ser Feta",
    20: "Tuńczyk",
    21: "Szpinak",
    22: "Czosnek",
    23: "Karczochy",
    24: "Kapary",
    25: "Anchovies",
    26: "Owoce morza",
    27: "Kiełbasa",
    28: "Ogórek kiszony",
    29: "Brokuły",
    30: "Papryczka Jalapeno",
    31: "Ser Wędzony",
    32: "Ser Camembert",
    33: "Suszone pomidory",
    34: "Pesto",
    35: "Mascarpone",
    36: "Szparagi",
    37: "Bakłażan",
    38: "Cukinia",
    39: "Wołowina",
    40: "Sos BBQ",
    41: "Frytki",
    42: "Kebab",
    43: "Sos czosnkowy"
};

async function run() {
    db.serialize(() => {
        // 1. Fix menu_pizza IDs
        console.log("Resetting menu_pizza...");
        db.run("DELETE FROM menu_pizza");
        db.run("DELETE FROM sqlite_sequence WHERE name='menu_pizza'");
        
        const stmt = db.prepare("INSERT INTO menu_pizza (nazwa, cena_mala, cena_srednia, cena_duza) VALUES (?, ?, ?, ?)");
        pizzas.forEach(pizza => {
            stmt.run(pizza.nazwa, pizza.cena_mala, pizza.cena_srednia, pizza.cena_duza);
        });
        stmt.finalize();
        console.log("Pizzas re-inserted starting from ID 1.");

        // 2. Populate skladniki
        console.log("Populating skladniki...");
        db.run("DELETE FROM skladniki");
        db.run("DELETE FROM sqlite_sequence WHERE name='skladniki'");
        
        const stmtSkladniki = db.prepare("INSERT INTO skladniki (id, nazwa) VALUES (?, ?)");
        // Insert up to 50 ingredients to be safe
        for (let i = 1; i <= 50; i++) {
            const name = ingredientsMap[i] || `Składnik ${i}`;
            stmtSkladniki.run(i, name);
        }
        stmtSkladniki.finalize();
        console.log("Skladniki populated.");

        // 3. Import relacja_skladniki from CSV
        console.log("Importing relacja_skladniki...");
        db.run("DELETE FROM relacja_skladniki");
        
        // Read CSV from Documents (assuming the user provided path is correct relative to workspace or absolute)
        // The user provided attachment path: c:\Users\tobia\Documents\relacja_skladniki.csv
        // I will try to read it from there.
        const csvPath = 'c:\\Users\\tobia\\Documents\\relacja_skladniki.csv';
        
        try {
            const fileContent = fs.readFileSync(csvPath, 'utf-8');
            const records = csv.parse(fileContent, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true
            });

            const stmtRelacja = db.prepare("INSERT INTO relacja_skladniki (id_pizza, id_skladnik) VALUES (?, ?)");
            records.forEach(record => {
                stmtRelacja.run(parseInt(record.id_pizza), parseInt(record.id_skladnik));
            });
            stmtRelacja.finalize();
            console.log(`Imported ${records.length} relations.`);
        } catch (err) {
            console.error("Error reading CSV:", err.message);
        }

        // 4. Add 'skladniki' column to 'zamowienia' if not exists
        console.log("Adding 'skladniki' column to 'zamowienia'...");
        db.run("ALTER TABLE zamowienia ADD COLUMN skladniki TEXT", (err) => {
            if (err && err.message.includes("duplicate column name")) {
                console.log("Column 'skladniki' already exists.");
            } else if (err) {
                console.error("Error adding column:", err.message);
            } else {
                console.log("Column 'skladniki' added.");
            }
        });
    });

    db.close();
}

run();
