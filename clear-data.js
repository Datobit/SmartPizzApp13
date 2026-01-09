import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAndReloadData() {
  console.log('[CLEAN] Czyszczę stare dane...');
  
  await prisma.pizza.deleteMany();
  await prisma.ulica.deleteMany();
  
  console.log(' Dane wyczyszczone');
  
  await prisma.$disconnect();
}

clearAndReloadData().catch(console.error);