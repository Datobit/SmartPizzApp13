const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Usuwanie zduplikowanych napojów...');
  
  // Usuń napoje z ID 8-14 (duplikaty)
  const result = await prisma.napoj.deleteMany({
    where: {
      id: {
        in: [8, 9, 10, 11, 12, 13, 14]
      }
    }
  });
  
  console.log(`✅ Usunięto ${result.count} zduplikowanych napojów`);
  
  // Sprawdź co zostało
  const napoje = await prisma.napoj.findMany({
    orderBy: { id: 'asc' }
  });
  
  console.log('\n=== NAPOJE PO USUNIĘCIU DUPLIKATÓW ===');
  console.log('Liczba napojów:', napoje.length);
  napoje.forEach(napoj => {
    console.log(`ID: ${napoj.id}, Nazwa: ${napoj.nazwa}, Cena: ${napoj.cena} PLN`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
