import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
const Database = sqlite3.Database;

const prisma = new PrismaClient();

// Funkcja do kopiowania danych z SQLite do Prisma
async function copyData() {
  return new Promise((resolve, reject) => {
    const sourceDb = new Database('./smartpizzapp13-T3.db');
    
    console.log('🔍 Sprawdzam dane w oryginalnej bazie...');
    
    // Sprawdź pizze
    sourceDb.all("SELECT * FROM `Menu pizza`", async (err, pizzas) => {
      if (err) {
        console.error('Błąd odczytu pizz:', err);
        reject(err);
        return;
      }
      
      console.log(`📊 Znaleziono ${pizzas.length} pizz`);
      
      // Kopiuj pizze
      for (const pizza of pizzas) {
        try {
          await prisma.pizza.create({
            data: {
              nazwa: pizza.nazwa,
              cena_mala: pizza.cena_mala || 0,
              cena_srednia: pizza.cena_srednia || 0,
              cena_duza: pizza.cena_duza || 0
            }
          });
          console.log(`✅ Skopiowano pizzę: ${pizza.nazwa}`);
        } catch (error) {
          console.log(`⚠️ Pizza ${pizza.nazwa} już istnieje lub błąd:`, error.message);
        }
      }
      
      // Sprawdź napoje
      sourceDb.all("SELECT * FROM Napoje", async (err, napoje) => {
        if (err) {
          console.error('Błąd odczytu napojów:', err);
          return;
        }
        
        console.log(`📊 Znaleziono ${napoje.length} napojów`);
        
        // Kopiuj napoje
        for (const napoj of napoje) {
          try {
            await prisma.napoj.create({
              data: {
                nazwa: napoj.nazwa,
                cena: napoj.cena
              }
            });
            console.log(`✅ Skopiowano napój: ${napoj.nazwa}`);
          } catch (error) {
            console.log(`⚠️ Napój ${napoj.nazwa} już istnieje lub błąd:`, error.message);
          }
        }
        
        // Sprawdź ulice
        sourceDb.all("SELECT nazwa1 as nazwa FROM ULIC", async (err, ulice) => {
          if (err) {
            console.error('Błąd odczytu ulic:', err);
            return;
          }
          
          console.log(`📊 Znaleziono ${ulice.length} ulic`);
          
          // Kopiuj ulice
          for (const ulica of ulice) {
            try {
              await prisma.ulica.create({
                data: {
                  nazwa: ulica.nazwa
                }
              });
              console.log(`✅ Skopiowano ulicę: ${ulica.nazwa}`);
            } catch (error) {
              console.log(`⚠️ Ulica ${ulica.nazwa} już istnieje lub błąd:`, error.message);
            }
          }
          
          // Sprawdź pozycje extra
          sourceDb.all("SELECT * FROM pozycje_extra", async (err, extras) => {
            if (err) {
              console.error('Błąd odczytu pozycji extra:', err);
              return;
            }
            
            console.log(`📊 Znaleziono ${extras.length} pozycji extra`);
            
            // Kopiuj pozycje extra
            for (const extra of extras) {
              try {
                await prisma.pozycjaExtra.create({
                  data: {
                    nazwa: extra.nazwa,
                    cena: extra.cena
                  }
                });
                console.log(`✅ Skopiowano pozycję extra: ${extra.nazwa}`);
              } catch (error) {
                console.log(`⚠️ Pozycja extra ${extra.nazwa} już istnieje lub błąd:`, error.message);
              }
            }
            
            console.log('🎉 Kopiowanie danych zakończone!');
            sourceDb.close();
            resolve();
          });
        });
      });
    });
  });
}

// Uruchom kopiowanie
copyData()
  .then(() => {
    console.log('✅ Wszystkie dane zostały skopiowane!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Błąd podczas kopiowania:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });