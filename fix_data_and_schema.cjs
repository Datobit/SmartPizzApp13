const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix encoding issues
  const fixes = [
    { id: 3, nazwa: 'zioła' },
    { id: 9, nazwa: 'tuńczyk' },
    { id: 23, nazwa: 'kiełbasa' },
    { id: 26, nazwa: 'brokuły' },
    { id: 33, nazwa: 'małże' },
    { id: 36, nazwa: 'serek górski' },
    { id: 37, nazwa: 'ogórek konserwowy' },
    { id: 41, nazwa: 'szynka długodojrzewająca' }
  ];

  for (const fix of fixes) {
    await prisma.skladnik.update({
      where: { id: fix.id },
      data: { nazwa: fix.nazwa }
    });
    console.log(`Fixed ${fix.id}: ${fix.nazwa}`);
  }

  // Add column 'skladniki' to 'zamowienia' table using raw SQL
  try {
    await prisma.$executeRaw`ALTER TABLE zamowienia ADD COLUMN skladniki TEXT DEFAULT NULL`;
    console.log("Added column 'skladniki' to 'zamowienia' table");
  } catch (e) {
    console.log("Column 'skladniki' might already exist or error:", e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
