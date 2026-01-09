const { PrismaClient } = require("@prisma/client");

async function testNewStructure() {
  console.log('=== TEST Z NOWĄ STRUKTURĄ TABELI ===');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('\nTest zapisu z nową strukturą...');
    const result = await prisma.$executeRaw`
      INSERT INTO zamowienia (
        telefon,
        adres,
        pizze,
        sosy,
        napoj,
        pozycje_extra,
        platnosc,
        cena_calkowita
      ) VALUES (
        ${'555666777'},
        ${'Test Nova Struktura'},
        ${JSON.stringify([{id: 41, rozmiar: 'mala'}])},
        ${JSON.stringify({pomidorowy: 1, czosnkowy: 0})},
        ${null},
        ${JSON.stringify([])},
        ${'gotowka'},
        ${29.50}
      )
    `;
    console.log(' SUKCES z nową strukturą:', result);

    // Sprawdzmy czy rekord został dodany
    const lastRecord = await prisma.$queryRaw`
      SELECT * FROM zamowienia ORDER BY id DESC LIMIT 1
    `;
    console.log('[LISTA] Ostatni rekord:', lastRecord);

  } catch (error) {
    console.error(' Błąd:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNewStructure().catch(console.error);