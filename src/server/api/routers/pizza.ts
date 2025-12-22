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
      // Szukamy ulic które zawierają podane litery (minimum 3 znaki)
      if (input.query.length < 3) {
        return [];
      }

      const ulice = await db.ulica.findMany({
        where: {
          ulica: {
            contains: input.query,
          },
        },
        distinct: ['ulica', 'dzielnica_nazwa'], // Zwracamy unikalne pary ulica + dzielnica
        select: {
          ulica: true,
          dzielnica_nazwa: true,
        },
        take: 50, // Pobieramy więcej, aby potem posortować
      });
      
      // Sortujemy: najpierw ulice zaczynające się od wpisanej frazy, potem pozostałe
      const sorted = ulice.sort((a, b) => {
        const aStartsWith = a.ulica?.toLowerCase().startsWith(input.query.toLowerCase()) ?? false;
        const bStartsWith = b.ulica?.toLowerCase().startsWith(input.query.toLowerCase()) ?? false;
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // Jeśli obie zaczynają się lub obie nie zaczynają się, sortuj alfabetycznie
        return (a.ulica ?? '').localeCompare(b.ulica ?? '', 'pl');
      }).slice(0, 10); // Bierzemy tylko 10 pierwszych wyników
      
      console.log("Search query:", input.query, "Found unique streets:", sorted.length, sorted);
      return sorted;
    }),

  // Pobiera informacje o dzielnicy dla danego klastra, ulicy i numeru
  getDzielnicaForUlica: publicProcedure
    .input(z.object({ 
      miejscowosc: z.string().optional(), // Teraz to jest nazwa klastra/dzielnicy
      ulica: z.string(),
      numer: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Jeśli podano dzielnicę, używamy jej do filtrowania
      const whereClause: any = {
        ulica: {
          equals: input.ulica,
        },
      };

      // Dodaj filtr po dzielnicy tylko jeśli podano miejscowosc
      if (input.miejscowosc) {
        whereClause.dzielnica_nazwa = {
          equals: input.miejscowosc,
        };
      }
      
      // Jeśli mamy numer, szukamy dokładnego dopasowania: (dzielnica_nazwa) + ulica + numer
      if (input.numer && input.numer.trim()) {
        const ulicaRecord = await db.ulica.findFirst({
          where: {
            ...whereClause,
            numer: {
              equals: input.numer.trim(),
            },
          },
          include: {
            dzielnica: true,
          },
        });

        if (ulicaRecord && ulicaRecord.dzielnica) {
          const klasterInfo = input.miejscowosc ? ` w klastrze ${input.miejscowosc}` : '';
          console.log(`Znaleziono dokładny adres${klasterInfo}: ${input.ulica} ${input.numer}`);
          return {
            dzielnica_nazwa: ulicaRecord.dzielnica_nazwa,
            cena_dzielnica: ulicaRecord.dzielnica.cena_dzielnica,
          };
        }
      }
      
      // Jeśli nie znaleziono dokładnego numeru, zwracamy pierwszy wynik dla (klastra) + ulicy
      const ulicaRecord = await db.ulica.findFirst({
        where: whereClause,
        include: {
          dzielnica: true,
        },
      });

      if (ulicaRecord && ulicaRecord.dzielnica) {
        const klasterInfo = input.miejscowosc ? ` w klastrze ${input.miejscowosc}` : '';
        console.log(`Znaleziono ulicę${klasterInfo}: ${input.ulica} (bez dokładnego numeru)`);
        return {
          dzielnica_nazwa: ulicaRecord.dzielnica_nazwa,
          cena_dzielnica: ulicaRecord.dzielnica.cena_dzielnica,
        };
      }
      
      return null;
    }),

  // Oblicza cenę zamówienia
  calculatePrice: publicProcedure
    .input(
      z.object({
        pizze: z.array(
          z.object({
            id: z.number(),
            rozmiar: z.enum(["mala", "srednia", "duza"]),
            isKupony: z.boolean().optional(),
            polNaPol: z.object({
              id: z.number(),
            }).optional(),
          })
        ),
        sosy: z.object({
          pomidorowy: z.number().min(0),
          czosnkowy: z.number().min(0),
        }),
        napojeIds: z.array(z.number()).optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
        adres: z.string().optional(),
        customDeliveryPrice: z.number().optional(),
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
          const kuponEligible = !!pizza.isKupony;
          
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

      // Cena napojów
      console.log("Napoje IDs:", input.napojeIds);
      if (input.napojeIds && input.napojeIds.length > 0) {
        for (const napojId of input.napojeIds) {
          const napoj = await db.napoj.findUnique({
            where: { id: napojId },
          });
          console.log(`Napój ${napojId}:`, napoj);
          if (napoj) {
            totalPrice += napoj.cena;
            console.log(`Dodano napój ${napoj.nazwa}, cena: ${napoj.cena}, total: ${totalPrice}`);
          }
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

      // Cena dostawy według dzielnicy
      if (input.typZamowienia === "dowoz") {
        // Jeśli użytkownik podał własną cenę dostawy, używamy jej
        if (input.customDeliveryPrice !== undefined) {
          console.log('Używam niestandardowej ceny dostawy:', input.customDeliveryPrice, 'PLN');
          totalPrice += input.customDeliveryPrice;
        } else if (input.adres) {
          // W przeciwnym razie wyszukujemy cenę na podstawie adresu
          const adres = input.adres;
          const firstPart = adres.split(',')[0];
          const adresParts = firstPart ? firstPart.trim() : adres;
          const streetMatch = adresParts.match(/^([\D\s]+?)\s*\d*[a-zA-Z]?$/);
          const streetName = (streetMatch && streetMatch[1]) ? streetMatch[1].trim() : adresParts;
          
          console.log('Szukam adresu:', input.adres, '-> nazwa ulicy:', streetName);
          
          const ulicaRecord = await db.ulica.findFirst({
            where: {
              ulica: {
                contains: streetName,
              },
            },
            include: {
              dzielnica: true,
            },
          });

          console.log('Znaleziono rekord ulicy:', ulicaRecord);

          if (ulicaRecord && ulicaRecord.dzielnica) {
            console.log('Dodaję cenę dostawy:', ulicaRecord.dzielnica.cena_dzielnica, 'PLN');
            totalPrice += ulicaRecord.dzielnica.cena_dzielnica;
          } else {
            console.log('Nie znaleziono adresu w bazie - brak opłaty za dowóz');
          }
        }
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
            isKupony: z.boolean().optional(),
            polNaPol: z.object({
              id: z.number(),
            }).optional(),
          })
        ),
        sosy: z.object({
          pomidorowy: z.number().min(0),
          czosnkowy: z.number().min(0),
        }),
        napojeIds: z.array(z.number()).optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        platnosc: z.enum(["gotowka", "karta"]),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
        skladniki: z.string().optional(),
        customDeliveryPrice: z.number().optional(),
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
            const kuponEligible = !!pizza.isKupony;
            
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

        // Cena napojów
        console.log("CreateOrder - Napoje IDs:", input.napojeIds);
        if (input.napojeIds && input.napojeIds.length > 0) {
          for (const napojId of input.napojeIds) {
            const napoj = await tx.napoj.findUnique({
              where: { id: napojId },
            });
            console.log(`CreateOrder - Napój ${napojId}:`, napoj);
            if (napoj) {
              totalPrice += napoj.cena;
              console.log(`CreateOrder - Dodano napój ${napoj.nazwa}, cena: ${napoj.cena}, total: ${totalPrice}`);
            }
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

        // Cena dostawy według dzielnicy
        if (input.typZamowienia === "dowoz") {
          // Jeśli użytkownik podał własną cenę dostawy, używamy jej
          if (input.customDeliveryPrice !== undefined) {
            console.log('Używam niestandardowej ceny dostawy (placeOrder):', input.customDeliveryPrice, 'PLN');
            totalPrice += input.customDeliveryPrice;
          } else if (input.adres) {
            // W przeciwnym razie wyszukujemy cenę na podstawie adresu
            const adres = input.adres;
            const firstPart = adres.split(',')[0];
            const adresParts = firstPart ? firstPart.trim() : adres;
            const streetMatch = adresParts.match(/^([\D\s]+?)\s*\d*[a-zA-Z]?$/);
            const streetName = (streetMatch && streetMatch[1]) ? streetMatch[1].trim() : adresParts;
            
            console.log('Szukam adresu (placeOrder):', input.adres, '-> nazwa ulicy:', streetName);
            
            const ulicaRecord = await tx.ulica.findFirst({
              where: {
                ulica: {
                  contains: streetName,
                },
              },
              include: {
                dzielnica: true,
              },
            });

            console.log('Znaleziono rekord ulicy (placeOrder):', ulicaRecord);

            if (ulicaRecord && ulicaRecord.dzielnica) {
              console.log('Dodaję cenę dostawy (placeOrder):', ulicaRecord.dzielnica.cena_dzielnica, 'PLN');
              totalPrice += ulicaRecord.dzielnica.cena_dzielnica;
            } else {
              console.log('Nie znaleziono adresu w bazie (placeOrder) - brak opłaty za dowóz');
            }
          }
        }

        return totalPrice;
      });

      // Kolumny już istnieją w nowej strukturze MariaDB - pomijamy ALTER TABLE

      // Zapisujemy zamówienie bezpośrednio do tabeli przez raw SQL
      console.log("Zapisywanie zamówienia do bazy...");
      
      // Zapisz do tabeli zamowienia z nową strukturą
      // Używamy NOW() dla MariaDB/MySQL
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
          ${input.napojeIds && input.napojeIds.length > 0 ? JSON.stringify(input.napojeIds) : null},
          ${JSON.stringify(input.pozycjeExtraIds)},
          ${input.platnosc},
          ${priceResult},
          NOW(),
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