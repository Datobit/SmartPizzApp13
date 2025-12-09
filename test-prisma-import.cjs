// Test importu Prisma Client
console.log('Testing Prisma imports...');

try {
  const prisma1 = require('@prisma/client');
  console.log('require(@prisma/client):', Object.keys(prisma1));
} catch (e) {
  console.log('require failed:', e.message);
}

try {
  import('@prisma/client').then(prisma2 => {
    console.log('import(@prisma/client):', Object.keys(prisma2));
  }).catch(e => {
    console.log('dynamic import failed:', e.message);
  });
} catch (e) {
  console.log('import failed:', e.message);
}

try {
  const { default: DefaultPrisma } = require('@prisma/client');
  console.log('Default export:', DefaultPrisma);
  if (DefaultPrisma && DefaultPrisma.PrismaClient) {
    console.log('Found PrismaClient in default export');
  }
} catch (e) {
  console.log('default import failed:', e.message);
}