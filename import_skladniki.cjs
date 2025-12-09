const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const data = fs.readFileSync('c:\\Users\\tobia\\Documents\\skladniki.csv', 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    console.log(`Found ${lines.length} lines in CSV`);

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i];
      const parts = line.split(';');
      if (parts.length >= 2) {
        const id = parseInt(parts[0].trim());
        let nazwa = parts[1].trim();
        // Remove quotes if present
        if (nazwa.startsWith("'") && nazwa.endsWith("'")) {
          nazwa = nazwa.substring(1, nazwa.length - 1);
        }
        
        console.log(`Importing: ${id} - ${nazwa}`);
        
        await prisma.skladnik.upsert({
          where: { id: id },
          update: { nazwa: nazwa },
          create: {
            id: id,
            nazwa: nazwa
          }
        });
      }
    }
    console.log('Import completed');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
