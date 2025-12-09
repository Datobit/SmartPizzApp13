import { db } from "~/server/db";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const pizzaRouter = createTRPCRouter({
  // Pobiera wszystkie pizze z menu
  getAllPizzas: publicProcedure.query(async () => {
    const pizzas = await db.pizza.findMany({
      include: {
        skladniki: {
          include: {
            skladnik: true
          }
        }
      }
    });
    console.log("Found pizzas:", pizzas.length, pizzas);
    return pizzas;
  }),

  // Pobiera wszystkie składniki
  getAllSkladniki: publicProcedure.query(async () => {
    const skladniki = await db.skladnik.findMany();
    console.log("Found skladniki:", skladniki.length);
    return skladniki;
  }),

  // Pobiera wszystkie napoje
  getAllNapoje: publicProcedure.query(async () => {
    return db.napoj.findMany();
  }),

  // Pobiera wszystkie pozycje extra
  getAllPozycjeExtra: publicProcedure.query(async () => {
    const extras = await db.pozycjaExtra.findMany();
    console.log("Found pozycje extra:", extras.length, extras);
    return extras;
  }),

  // Wyszukuje ulice na podstawie fragmentu nazwy
  searchUlice: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const ulice = await db.ulica.findMany({
        where: {
          nazwa: {
            contains: input.query,
          },
        },
        take: 10,
      });
      console.log("Search query:", input.query, "Found streets:", ulice.length, ulice);
      return ulice;
    }),

  // Oblicza cenę zamówienia
  calculatePrice: publicProcedure
    .input(
      z.object({
        pizze: z.array(
          z.object({
            id: z.number(),
            rozmiar: z.enum(["mala", "srednia", "duza"]),
            polNaPol: z.object({
              id: z.number(),
            }).optional(),
          })
        ),
        sosy: z.object({
          pomidorowy: z.number().min(0),
          czosnkowy: z.number().min(0),
        }),
        napojId: z.number().optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      let totalPrice = 0;

      // Cena pizz
      for (const pizza of input.pizze) {
        const pizzaData = await db.pizza.findUnique({
          where: { id: pizza.id },
        });
        
        if (pizzaData) {
          let pizzaPrice = 0;
          const kuponEligible = !!input.isKupony;
          
          if (kuponEligible) {
            // Kupony: średnia 0 zł, duża 10 zł
            pizzaPrice = pizza.rozmiar === "duza" ? 10 : 0;
          } else {
            // Bazowa cena pizzy
            switch (pizza.rozmiar) {
              case "mala":
                pizzaPrice = pizzaData.cena_mala;
                break;
              case "srednia":
                pizzaPrice = pizzaData.cena_srednia;
                break;
              case "duza":
                pizzaPrice = pizzaData.cena_duza;
                break;
            }
          }
          
          // Jeśli to pizza pół na pół
          if (pizza.polNaPol && !kuponEligible) {
            const drugaPizzaData = await db.pizza.findUnique({
              where: { id: pizza.polNaPol.id },
            });
            
            if (drugaPizzaData) {
              let drugaCena = 0;
              switch (pizza.rozmiar) {
                case "mala":
                  drugaCena = drugaPizzaData.cena_mala;
                  break;
                case "srednia":
                  drugaCena = drugaPizzaData.cena_srednia;
                  break;
                case "duza":
                  drugaCena = drugaPizzaData.cena_duza;
                  break;
              }
              
              // Cena pół na pół: wyższa cena + dopłata 4 PLN
              pizzaPrice = Math.max(pizzaPrice, drugaCena) + 4;
            }
          }
          
          totalPrice += pizzaPrice;
        }
      }

      // Cena sosów (2 PLN za sztukę)
      totalPrice += (input.sosy.pomidorowy + input.sosy.czosnkowy) * 2;

      // Cena napoju
      if (input.napojId) {
        const napoj = await db.napoj.findUnique({
          where: { id: input.napojId },
        });
        if (napoj) {
          totalPrice += napoj.cena;
        }
      }

      // Cena pozycji extra
      if (input.pozycjeExtraIds) {
        for (const extraId of input.pozycjeExtraIds) {
          const extra = await db.pozycjaExtra.findUnique({
            where: { id: extraId },
          });
          if (extra) {
            totalPrice += extra.cena;
          }
        }
      }

      // Dostawa 5 PLN jeśli zamówienie < 100 PLN
      if (input.typZamowienia === "dowoz" && totalPrice < 100) {
        totalPrice += 5;
      }

      return { totalPrice };
    }),

  // Składa zamówienie
  placeOrder: publicProcedure
    .input(
      z.object({
        telefon: z.string(),
        adres: z.string(),
        pizze: z.array(
          z.object({
            id: z.number(),
            rozmiar: z.enum(["mala", "srednia", "duza"]),
            polNaPol: z.object({
              id: z.number(),
            }).optional(),
          })
        ),
        sosy: z.object({
          pomidorowy: z.number().min(0),
          czosnkowy: z.number().min(0),
        }),
        napojId: z.number().optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        platnosc: z.enum(["gotowka", "karta"]),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
        skladniki: z.string().optional(),
      })
      .refine(
        (data) => {
          // Dla dowozu wymagane są telefon i adres
          if (data.typZamowienia === "dowoz") {
            return /^\d{7,11}$/.test(data.telefon) && data.adres.trim().length > 0;
          }
          return true;
        },
        {
          message: "Dla dowozu wymagany jest poprawny telefon i adres",
        }
      )
    )
    .mutation(async ({ input }) => {
      // Najpierw obliczamy cenę
      const priceResult = await db.$transaction(async (tx: any) => {
        let totalPrice = 0;

        // Cena pizz
        for (const pizza of input.pizze) {
          const pizzaData = await tx.pizza.findUnique({
            where: { id: pizza.id },
          });
          
          if (pizzaData) {
            let pizzaPrice = 0;
            const kuponEligible = !!input.isKupony;
            
            if (kuponEligible) {
              pizzaPrice = pizza.rozmiar === "duza" ? 10 : 0;
            } else {
              // Bazowa cena pizzy
              switch (pizza.rozmiar) {
                case "mala":
                  pizzaPrice = pizzaData.cena_mala;
                  break;
                case "srednia":
                  pizzaPrice = pizzaData.cena_srednia;
                  break;
                case "duza":
                  pizzaPrice = pizzaData.cena_duza;
                  break;
              }
            }
            
            // Jeśli to pizza pół na pół (wyłączone dla kuponów)
            if (pizza.polNaPol && !kuponEligible) {
              const drugaPizzaData = await tx.pizza.findUnique({
                where: { id: pizza.polNaPol.id },
              });
              
              if (drugaPizzaData) {
                let drugaCena = 0;
                switch (pizza.rozmiar) {
                  case "mala":
                    drugaCena = drugaPizzaData.cena_mala;
                    break;
                  case "srednia":
                    drugaCena = drugaPizzaData.cena_srednia;
                    break;
                  case "duza":
                    drugaCena = drugaPizzaData.cena_duza;
                    break;
                }
                
                // Cena pół na pół: wyższa cena + dopłata 4 PLN
                pizzaPrice = Math.max(pizzaPrice, drugaCena) + 4;
              }
            }
            
            totalPrice += pizzaPrice;
          }
        }

        // Cena sosów
        totalPrice += (input.sosy.pomidorowy + input.sosy.czosnkowy) * 2;

        // Cena napoju
        if (input.napojId) {
          const napoj = await tx.napoj.findUnique({
            where: { id: input.napojId },
          });
          if (napoj) {
            totalPrice += napoj.cena;
          }
        }

        // Cena pozycji extra
        if (input.pozycjeExtraIds) {
          for (const extraId of input.pozycjeExtraIds) {
            const extra = await tx.pozycjaExtra.findUnique({
              where: { id: extraId },
            });
            if (extra) {
              totalPrice += extra.cena;
            }
          }
        }

        // Dostawa
        if (input.typZamowienia === "dowoz" && totalPrice < 100) {
          totalPrice += 5;
        }

        return totalPrice;
      });

      // Upewniamy się, że kolumna is_kupony istnieje (ignoruj błąd jeśli już istnieje)
      try {
        await db.$executeRaw`ALTER TABLE zamowienia ADD COLUMN is_kupony INTEGER DEFAULT 0`;
      } catch (e) {
        // kolumna już istnieje – ignorujemy
      }

      // Upewniamy się, że kolumna typ_zamowienia istnieje (ignoruj błąd jeśli już istnieje)
      try {
        await db.$executeRaw`ALTER TABLE zamowienia ADD COLUMN typ_zamowienia TEXT DEFAULT NULL`;
      } catch (e) {
        // kolumna już istnieje – ignorujemy
      }

      // Upewniamy się, że kolumna skladniki istnieje (ignoruj błąd jeśli już istnieje)
      try {
        await db.$executeRaw`ALTER TABLE zamowienia ADD COLUMN skladniki TEXT DEFAULT NULL`;
      } catch (e) {
        // kolumna już istnieje – ignorujemy
      }

      // Zapisujemy zamówienie bezpośrednio do tabeli przez raw SQL
      console.log("Zapisywanie zamówienia do bazy...");
      
      // Zapisz do tabeli zamowienia z nową strukturą
      // Używamy DATETIME('now', 'localtime') dla polskiego czasu
      const insertResult = await db.$executeRaw`
        INSERT INTO zamowienia (
          telefon,
          adres,
          pizze,
          sosy,
          napoj,
          pozycje_extra,
          platnosc,
          cena_calkowita,
          created_at,
          is_kupony,
          typ_zamowienia,
          skladniki
        ) VALUES (
          ${input.telefon},
          ${input.adres},
          ${JSON.stringify(input.pizze)},
          ${JSON.stringify(input.sosy)},
          ${input.napojId ? String(input.napojId) : null},
          ${JSON.stringify(input.pozycjeExtraIds)},
          ${input.platnosc},
          ${priceResult},
          DATETIME('now', 'localtime'),
          ${input.isKupony ? 1 : 0},
          ${input.typZamowienia},
          ${input.skladniki || null}
        )
      `;
      
      console.log("Zamówienie zapisane pomyślnie:", insertResult);

      return {
        success: true,
        zamowienieId: Date.now(), // Używamy timestamp jako ID
        cenaCalkwita: priceResult,
      };
    }),
});