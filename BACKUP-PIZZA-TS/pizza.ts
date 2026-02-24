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

  // Pobiera aktywne sesje kierowców
  getAktywneSesje: publicProcedure.query(async () => {
    const sesje = await db.sesja.findMany({
      where: {
        status: 'otwarta'
      },
      include: {
        kierowca: true,
        transakcje: {
          orderBy: {
            data_utworzenia: 'desc'
          }
        }
      },
      orderBy: {
        data_otwarcia: 'desc'
      }
    });
    
    // Przelicz aktualne saldo z transakcji
    const sesjeZSaldem = sesje.map((sesja: any) => {
      const saldo = sesja.transakcje.reduce((sum: number, t: any) => {
        return sum + (t.typ === 'wplyw' ? Number(t.kwota) : -Number(t.kwota));
      }, 0);
      
      return {
        ...sesja,
        saldo_aktualne: saldo
      };
    });
    
    return sesjeZSaldem;
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
      const sorted = ulice.sort((a: any, b: any) => {
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
            numerZnaleziony: true,
          };
        } else {
          // Numer nie został znaleziony w bazie - zwróć null aby frontend pokazał ostrzeżenie
          console.log(`Nie znaleziono numeru ${input.numer} dla ulicy ${input.ulica}`);
          return null;
        }
      }
      
      // Jeśli nie podano numeru, zwracamy pierwszy wynik dla (klastra) + ulicy
      const ulicaRecord = await db.ulica.findFirst({
        where: whereClause,
        include: {
          dzielnica: true,
        },
      });

      if (ulicaRecord && ulicaRecord.dzielnica) {
        const klasterInfo = input.miejscowosc ? ` w klastrze ${input.miejscowosc}` : '';
        console.log(`Znaleziono ulicę${klasterInfo}: ${input.ulica} (bez sprawdzania numeru)`);
        return {
          dzielnica_nazwa: ulicaRecord.dzielnica_nazwa,
          cena_dzielnica: ulicaRecord.dzielnica.cena_dzielnica,
          numerZnaleziony: false,
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
          pom: z.number().min(0),
          czos: z.number().min(0),
        }),
        napojeIds: z.array(z.number()).optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
        adres: z.string().optional(),
        customDeliveryPrice: z.number().optional(),
        modyfikacjeSkladnikow: z.record(z.string(), z.record(z.string(), z.number())).optional(),
      })
    )
    .mutation(async ({ input }) => {
      let totalPrice = 0;

      // Cena pizz
      for (let i = 0; i < input.pizze.length; i++) {
        const pizza = input.pizze[i];
        if (!pizza) continue;
        
        const pizzaData = await db.pizza.findUnique({
          where: { id: pizza.id },
          include: {
            skladniki: {
              include: {
                skladnik: true
              }
            }
          }
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
          
          // Oblicz modyfikacje składników dla tej pizzy
          if (input.modyfikacjeSkladnikow) {
            const pizzaKey = `${i}`;
            const modyfikacje = input.modyfikacjeSkladnikow[pizzaKey];
            
            if (modyfikacje) {
              // Pobierz bazowe składniki tej pizzy
              const bazoweSkladniki: Record<string, number> = {};
              pizzaData.skladniki.forEach((ps: any) => {
                bazoweSkladniki[ps.skladnik.nazwa] = 1; // Domyślnie 1x składnik
              });
              
              // Oblicz różnice
              for (const [skladnikNazwa, nowaIlosc] of Object.entries(modyfikacje)) {
                const bazowaIlosc = bazoweSkladniki[skladnikNazwa] || 0;
                const roznica = nowaIlosc - bazowaIlosc;
                
                // Tylko dodawanie składników zwiększa cenę (usuwanie nie zmniejsza)
                if (roznica > 0) {
                  // Znajdź składnik w bazie
                  const skladnik = await db.skladnik.findFirst({
                    where: { nazwa: skladnikNazwa }
                  });
                  
                  if (skladnik) {
                    const cenaZaSkladnik = pizza.rozmiar === "srednia" 
                      ? skladnik.cena_srednia 
                      : skladnik.cena_duza;
                    
                    pizzaPrice += roznica * cenaZaSkladnik;
                  }
                }
              }
            }
          }
          
          // Jeśli to pizza pół na pół
          if (pizza.polNaPol) {
            if (kuponEligible) {
              // Dla pizzy z kuponów: po prostu dodaj +4 PLN
              pizzaPrice += 4;
            } else {
              // Dla pizzy normalnej: wyższa cena z dwóch pizz + 4 PLN
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
          }
          
          totalPrice += pizzaPrice;
        }
      }

      // Cena sosów (2 PLN za sztukę)
      totalPrice += (input.sosy.pom + input.sosy.czos) * 2;

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
          pom: z.number().min(0),
          czos: z.number().min(0),
        }),
        napojeIds: z.array(z.number()).optional(),
        pozycjeExtraIds: z.array(z.number()).optional(),
        platnosc: z.enum(["gotowka", "karta", "online"]),
        isKupony: z.boolean().optional(),
        typZamowienia: z.enum(["na_miejscu", "na_wynos", "dowoz"]).optional(),
        skladniki: z.string().optional(),
        customDeliveryPrice: z.number().optional(),
        sesjaId: z.number().optional(),
        modyfikacjeSkladnikow: z.record(z.string(), z.record(z.string(), z.number())).optional(),
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
            
            // Oblicz modyfikacje składników dla tej pizzy
            if (input.modyfikacjeSkladnikow) {
              const pizzaIndex = input.pizze.indexOf(pizza);
              const pizzaKey = `${pizzaIndex}`;
              const modyfikacje = input.modyfikacjeSkladnikow[pizzaKey];
              
              if (modyfikacje) {
                // Pobierz bazowe składniki tej pizzy
                const pizzaDataWithIngredients = await tx.pizza.findUnique({
                  where: { id: pizza.id },
                  include: {
                    skladniki: {
                      include: {
                        skladnik: true
                      }
                    }
                  }
                });
                
                const bazoweSkladniki: Record<string, number> = {};
                pizzaDataWithIngredients?.skladniki.forEach((ps: any) => {
                  bazoweSkladniki[ps.skladnik.nazwa] = 1;
                });
                
                // Oblicz różnice
                for (const [skladnikNazwa, nowaIlosc] of Object.entries(modyfikacje)) {
                  const bazowaIlosc = bazoweSkladniki[skladnikNazwa] || 0;
                  const roznica = nowaIlosc - bazowaIlosc;
                  
                  if (roznica > 0) {
                    const skladnik = await tx.skladnik.findFirst({
                      where: { nazwa: skladnikNazwa }
                    });
                    
                    if (skladnik) {
                      const cenaZaSkladnik = pizza.rozmiar === "srednia" 
                        ? skladnik.cena_srednia 
                        : skladnik.cena_duza;
                      
                      pizzaPrice += roznica * cenaZaSkladnik;
                    }
                  }
                }
              }
            }
            
            // Jeśli to pizza pół na pół
            if (pizza.polNaPol) {
              if (kuponEligible) {
                // Dla pizzy z kuponów: po prostu dodaj +4 PLN
                pizzaPrice += 4;
              } else {
                // Dla pizzy normalnej: wyższa cena z dwóch pizz + 4 PLN
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
            }
            
            totalPrice += pizzaPrice;
          }
        }

        // Cena sosów
        totalPrice += (input.sosy.pom + input.sosy.czos) * 2;

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
      console.log("Sosy przed zapisem do DB:", input.sosy);
      console.log("Sosy JSON:", JSON.stringify(input.sosy));
      
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
          skladniki,
          sesja_id
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
          ${input.skladniki || null},
          ${input.sesjaId || null}
        )
      `;
      
      console.log("Zamówienie zapisane pomyślnie:", insertResult);
      
      // Jeśli przypisano do sesji i typ to dowóz, dodaj transakcję
      if (input.sesjaId && input.typZamowienia === 'dowoz') {
        console.log(`Dodaję transakcję ${priceResult} PLN do sesji ${input.sesjaId} (${input.platnosc})`);
        try {
          // Dla gotówki - wpływ, dla karty i online - wpływ ale nie wliczane do salda (forma_platnosci = karta/online)
          await db.$executeRaw`
            INSERT INTO transakcje (sesja_id, typ, kwota, forma_platnosci, opis)
            VALUES (${input.sesjaId}, 'wplyw', ${priceResult}, ${input.platnosc}, ${`Zamówienie - ${input.adres}`})
          `;
          console.log("Transakcja dodana pomyślnie");
        } catch (error) {
          console.error("Błąd dodawania transakcji:", error);
        }
      }

      return {
        success: true,
        zamowienieId: Date.now(), // Używamy timestamp jako ID
        cenaCalkwita: priceResult,
      };
    }),

  // Pobiera ostatnie zamówienia
  getRecentOrders: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ input }) => {
      const zamowienia = await db.zamowienie.findMany({
        take: input.limit,
        orderBy: {
          created_at: 'desc'
        },
        include: {
          sesja: {
            include: {
              kierowca: true
            }
          }
        }
      });
      
      return zamowienia;
    }),
});