const { PrismaClient } = require("@prisma/client");

async function testPrismaRaw() {
  console.log('=== TEST PRISMA RAW QUERIES ===');
  
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    // Test 1: Sprawdzenie tabel dostępnych dla Prisma
    console.log('\n1. Sprawdzanie tabel dostępnych dla Prisma...');
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table'
    `;
    console.log('Tabele:', tables);

    // Test 2: Próba zapisu z różnymi formatami
    console.log('\n2. Test zapisu z [Zamówienia]...');
    try {
      const result1 = await prisma.$executeRaw`
        INSERT INTO [Zamówienia] (adres, telefon, pizza, sosy, dodatki, cena, platnosc, godzina_otrzymania, sosy_ile, rozmiar)
        VALUES ('Prisma Test 1', 123456789, 1, 1, 'test', 25.50, 'gotowka', '2025-10-06 12:00:00', 1, 'mala')
      `;
      console.log('✅ Sukces [Zamówienia]:', result1);
    } catch (err1) {
      console.log('❌ Błąd [Zamówienia]:', err1.message);
    }

    // Test 3: Sprawdzenie schemy Prisma
    console.log('\n3. Sprawdzanie aktualnej bazy danych...');
    const dbInfo = await prisma.$queryRaw`PRAGMA database_list`;
    console.log('Info o bazie:', dbInfo);

  } catch (error) {
    console.error('Główny błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaRaw().catch(console.error);