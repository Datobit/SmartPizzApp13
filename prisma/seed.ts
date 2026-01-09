import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Dodaj pizze
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

  for (const pizza of pizzas) {
    await prisma.pizza.create({ data: pizza });
  }

  // Dodaj napoje
  const napoje = [
    { nazwa: "Coca Cola 0.5L", cena: 6 },
    { nazwa: "Pepsi 0.5L", cena: 6 },
    { nazwa: "Sprite 0.5L", cena: 6 },
    { nazwa: "Fanta 0.5L", cena: 6 },
    { nazwa: "Woda niegazowana 0.5L", cena: 4 },
    { nazwa: "Woda gazowana 0.5L", cena: 4 },
    { nazwa: "Sok pomarańczowy 0.3L", cena: 5 },
    { nazwa: "Sok jabłkowy 0.3L", cena: 5 },
  ];

  for (const napoj of napoje) {
    await prisma.napoj.create({ data: napoj });
  }

  // Dodaj ulice
  const ulice = [
    "Warszawska", "Krakowska", "Gdańska", "Wrocławska", "Poznańska",
    "Łódzka", "Szczecińska", "Bydgoska", "Lubelska", "Katowiecka",
    "Białostocka", "Gdyńska", "Częstochowska", "Radomska", "Sosnowiecka",
    "Toruńska", "Kielecka", "Gliwicka", "Zabrze", "Bytomska",
    "Rynek", "Główna", "Słoneczna", "Kwiatowa", "Leśna",
    "Ogrodowa", "Spacerowa", "Parkowa", "Miła", "Długa",
    "Krótka", "Nowa", "Stara", "Zielona", "Niebieska"
  ];

  for (const ulicaNazwa of ulice) {
    await prisma.ulica.create({ data: { ulica: ulicaNazwa } });
  }

  // Dodaj pozycje extra
  const pozycjeExtra = [
    { nazwa: "Frytki", cena: 8 },
    { nazwa: "Nuggetsy kurczaka", cena: 12 },
    { nazwa: "Krążki cebuli", cena: 10 },
    { nazwa: "Sałatka grecka", cena: 15 },
    { nazwa: "Sałatka Caesar", cena: 18 },
    { nazwa: "Paluszki mozzarella", cena: 14 },
    { nazwa: "Chlebek czosnkowy", cena: 7 },
    { nazwa: "Skrzydełka BBQ", cena: 16 },
  ];

  for (const extra of pozycjeExtra) {
    await prisma.pozycjaExtra.create({ data: extra });
  }

  console.log("Dane testowe zostały dodane do bazy danych!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });