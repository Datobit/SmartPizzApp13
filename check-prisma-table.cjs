const { PrismaClient } = require("@prisma/client");

async function checkPrismaTableStructure() {
  console.log('=== STRUKTURA TABELI ZAMOWIENIA W BAZIE PRISMA ===');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    // Sprawdzamy strukturę tabeli zamowienia
    console.log('\nStruktura tabeli "zamowienia":');
    const structure = await prisma.$queryRaw`
      PRAGMA table_info(zamowienia)
    `;
    console.log('Kolumny:', structure);

    // Sprawdzamy ile rekordów ma tabela
    console.log('\nLiczba rekordów w tabeli "zamowienia":');
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM zamowienia
    `;
    console.log('Count:', count);

    // Sprawdzamy przykładowe rekordy
    console.log('\nPrzykładowe rekordy:');
    const samples = await prisma.$queryRaw`
      SELECT * FROM zamowienia LIMIT 2
    `;
    console.log('Samples:', samples);

  } catch (error) {
    console.error('❌ Błąd:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrismaTableStructure().catch(console.error);