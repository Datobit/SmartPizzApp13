const { PrismaClient } = require("@prisma/client");

async function testCorrectTable() {
  console.log('=== TEST Z PRAWDZIWĄ NAZWĄ TABELI ===');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('\nTest zapisu do tabeli "zamowienia"...');
    const result = await prisma.$executeRaw`
      INSERT INTO zamowienia (adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar)
      VALUES ('Prisma Test CORRECT', 987654321, 2, 1, 'test correct', 35.75, 'karta', '2025-10-06 12:30:00', 1, 'srednia')
    `;
    console.log(' SUKCES z "zamowienia":', result);

    // Sprawdzmy czy rekord został dodany
    const lastRecord = await prisma.$queryRaw`
      SELECT * FROM zamowienia ORDER BY rowid DESC LIMIT 1
    `;
    console.log('[LISTA] Ostatni rekord:', lastRecord);

  } catch (error) {
    console.error(' Błąd:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCorrectTable().catch(console.error);