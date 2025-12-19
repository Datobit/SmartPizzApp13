const mysql = require('mysql2/promise');
require('dotenv').config();

const csvData = `id_pizza;Pizza;cena_mala;cena_srednia;cena_duza
1;MARGHARITA;20;30;35
2;AL FUNGHI;21;31;37
3;BOLOGNA;22;32;37
4;PROSCIUTTO;21;31;38
5;CAPRI;23;34;44
6;DOMINIKANA;23;35;41
7;OLIVIO;23;35;41
8;PEPPERONI;23;34;40
9;HAWAJSKA;23;35;42
10;NATURA;25;42;49
11;ZAMORSKA;25;39;44
12;LA GONDOLA;25;39;44
13;TRZYNASTKA;26;43;50
14;SPECJALE;26;40;45
15;WEGETARIAŃSKA I;26;40;45
16;WEGETARIAŃSKA II;25;39;45
17;TROPICANA;26;40;45
18;MAFIA;26;43;50
19;DIABLO;26;44;50
20;OGNISTA;25;40;45
21;MEXICANA;25;40;45
22;LATYNOSKA;25;40;45
23;O SOLE MIO;27;45;50
24;SYCYLIA;25;40;45
25;FRUTTI DI MARE;26;43;50
26;QUATRO STAGIONI;25;43;50
27;AMERICANA;27;44;50
28;CARLO;27;45;50
29;OSTATNIA W ŻYCIU;25;44;48
30;KILLER;25;42;47
31;MACGYVER;0;0;0
32;KEBAB PIZZA;26;44;50
33;GÓRALSKA;26;45;50
34;PIZZA SZEFA;25;42;48
35;CETRIOLO;24;40;45
36;ZBÓJNICKA;26;44;50
37;WIEJSKA;27;44;50
38;MĘSKA;29;47;52
39;JALAPENO;26;35;41
40;PARMA;29;47;52
41;RIO TUŃCZYK;25;41;48`;

async function updateMenu() {
  let connection;
  try {
    // Połącz z MariaDB
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pepperoni13',
      database: 'SmartPizzApp13'
    });

    // 1. Wyczyść tabelę
    await connection.execute("DELETE FROM menu_pizza");
    console.log("Tabela menu_pizza wyczyszczona.");

    // 2. Resetuj autoincrement
    await connection.execute("ALTER TABLE menu_pizza AUTO_INCREMENT = 1");

    // 3. Wstaw nowe dane
    const lines = csvData.split('\n');
    let count = 0;

    for (let i = 1; i < lines.length; i++) { // Pomiń nagłówek
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      if (parts.length < 2) continue;

      const id = parseInt(parts[0]);
      const nazwa = parts[1];
      const cena_mala = parseFloat(parts[2]) || 0;
      const cena_srednia = parseFloat(parts[3]) || 0;
      const cena_duza = parseFloat(parts[4]) || 0;

      await connection.execute(
        "INSERT INTO menu_pizza (id, nazwa, cena_mala, cena_srednia, cena_duza) VALUES (?, ?, ?, ?, ?)",
        [id, nazwa, cena_mala, cena_srednia, cena_duza]
      );
      count++;
    }

    console.log(`Zaktualizowano ${count} pozycji w menu.`);
    
    await connection.end();
  } catch (error) {
    console.error('Błąd:', error);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

updateMenu();
