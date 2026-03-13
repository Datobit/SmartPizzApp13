const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const napoje = await prisma.napoj.findMany({
    orderBy: { id: 'asc' }
  });
  
  console.log('\n=== WSZYSTKIE NAPOJE W BAZIE ===');
  console.log('Liczba napojów:', napoje.length);
  console.log('\nLista napojów:');
  napoje.forEach(napoj => {
    console.log(`ID: ${napoj.id}, Nazwa: ${napoj.nazwa}, Cena: ${napoj.cena} PLN`);
  });
  
  // Sprawdź duplikaty po nazwie
  const nazwyMap = {};
  napoje.forEach(napoj => {
    if (!nazwyMap[napoj.nazwa]) {
      nazwyMap[napoj.nazwa] = [];
    }
    nazwyMap[napoj.nazwa].push(napoj.id);
  });
  
  console.log('\n=== DUPLIKATY ===');
  Object.entries(nazwyMap).forEach(([nazwa, ids]) => {
    if (ids.length > 1) {
      console.log(`"${nazwa}" występuje ${ids.length} razy (IDs: ${ids.join(', ')})`);
    }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
