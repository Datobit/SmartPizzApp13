import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('🔍 Sprawdzam dane w bazie Prisma...');
  
  const pizzaCount = await prisma.pizza.count();
  const napojCount = await prisma.napoj.count();
  const ulicaCount = await prisma.ulica.count();
  const extraCount = await prisma.pozycjaExtra.count();
  
  console.log(`📊 Statystyki bazy danych:`);
  console.log(`- Pizze: ${pizzaCount}`);
  console.log(`- Napoje: ${napojCount}`);
  console.log(`- Ulice: ${ulicaCount}`);
  console.log(`- Pozycje extra: ${extraCount}`);
  
  if (pizzaCount > 0) {
    console.log('\n🍕 Przykładowe pizze:');
    const pizzas = await prisma.pizza.findMany({ take: 5 });
    pizzas.forEach(pizza => {
      console.log(`- ${pizza.nazwa}: mała ${pizza.cena_mala}zł, średnia ${pizza.cena_srednia}zł, duża ${pizza.cena_duza}zł`);
    });
  }
  
  if (napojCount > 0) {
    console.log('\n🥤 Napoje:');
    const napoje = await prisma.napoj.findMany();
    napoje.forEach(napoj => {
      console.log(`- ${napoj.nazwa}: ${napoj.cena}zł`);
    });
  }
  
  if (ulicaCount > 0) {
    console.log('\n🛣️ Przykładowe ulice:');
    const ulice = await prisma.ulica.findMany({ 
      where: { nazwa: { contains: 'Wyspi' } } 
    });
    ulice.forEach(ulica => {
      console.log(`- ${ulica.nazwa}`);
    });
  }
  
  console.log('\n✅ Sprawdzanie zakończone!');
}

checkData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });