import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { api } from "~/utils/api";

interface PizzaSelection {
  id: number;
  nazwa: string;
  rozmiar: "mala" | "srednia" | "duza";
  cena: number;
  isKupony: boolean;
  polNaPol?: {
    id: number;
    nazwa: string;
  };
  modifications?: Record<number, number>; // id_skladnik -> zmiana ilości (np. -1, +1)
}

interface OrderData {
  telefon: string;
  adres: string;
  pizze: PizzaSelection[];
  sosy: {
    pomidorowy: number;
    czosnkowy: number;
  };
  napojeIds: number[];
  pozycjeExtraIds: number[];
  platnosc: "gotowka" | "karta";
}

export default function Home() {
  // Typ zamówienia
  const [typZamowienia, setTypZamowienia] = useState<"na_miejscu" | "na_wynos" | "dowoz">("dowoz");

  const [orderData, setOrderData] = useState<OrderData>({
    telefon: "",
    adres: "",
    pizze: [],
    sosy: { pomidorowy: 0, czosnkowy: 0 },
    napojeIds: [],
    pozycjeExtraIds: [],
    platnosc: "gotowka",
  });

  // Oddzielne pola adresu
  const [miejscowosc, setMiejscowosc] = useState("");
  const [ulica, setUlica] = useState("");
  const [numerDomu, setNumerDomu] = useState("");
  const [numerMieszkania, setNumerMieszkania] = useState("");
  const [dodatkoweInfo, setDodatkoweInfo] = useState("");

  const [selectedPizzas, setSelectedPizzas] = useState<Set<number>>(new Set());
  const [currentPizzaSize, setCurrentPizzaSize] = useState<"mala" | "srednia" | "duza">("duza");
  const [streetSuggestions, setStreetSuggestions] = useState<{ulica: string, dzielnica_nazwa: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [totalPrice, setTotalPrice] = useState(0);
  const [showAddPizza, setShowAddPizza] = useState(false);
  const [isPolNaPol, setIsPolNaPol] = useState(false);
  const [isKupony, setIsKupony] = useState(false);
  const [showPolNaPolSelector, setShowPolNaPolSelector] = useState(false);
  const [firstPizzaId, setFirstPizzaId] = useState<number | null>(null);
  const [expandedPizzaIndex, setExpandedPizzaIndex] = useState<number | null>(null);
  const [dzielnicaNazwa, setDzielnicaNazwa] = useState<string>("");
  const [customDeliveryPrice, setCustomDeliveryPrice] = useState<number | null>(null);
  const [userManuallyChangedDzielnica, setUserManuallyChangedDzielnica] = useState(false);
  const [addressNotRecognized, setAddressNotRecognized] = useState(false);
  const [wybranaSesjaId, setWybranaSesjaId] = useState<number | null>(null);
  
  const numerDomuInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: pizzas, isLoading: pizzasLoading, error: pizzasError } = api.pizza.getAllPizzas.useQuery();
  const { data: napoje, isLoading: napojeLoading } = api.pizza.getAllNapoje.useQuery();
  const { data: pozycjeExtra, isLoading: extraLoading } = api.pizza.getAllPozycjeExtra.useQuery();
  const { data: skladniki, isLoading: skladnikiLoading, error: skladnikiError } = api.pizza.getAllSkladniki.useQuery();
  const { data: aktywneSesje, isLoading: sesjeLoading } = api.pizza.getAktywneSesje.useQuery();

  const searchStreets = api.pizza.searchUlice.useQuery(
    { query: ulica },
    { enabled: ulica.length > 2 }
  );

  const dzielnicaInfo = api.pizza.getDzielnicaForUlica.useQuery(
    { miejscowosc: miejscowosc || undefined, ulica: ulica, numer: numerDomu },
    { 
      enabled: ulica.length > 0 && numerDomu.length > 0 && typZamowienia === "dowoz",
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Debug - wyświetl dane w konsoli
  useEffect(() => {
    console.log("Pizzas data:", pizzas);
    console.log("Skladniki data:", skladniki);
    console.log("Skladniki error:", skladnikiError);
    console.log("Pizzas loading:", pizzasLoading);
    console.log("Pizzas error:", pizzasError);
    console.log("Pozycje extra data:", pozycjeExtra);
    console.log("Pozycje extra loading:", extraLoading);
    console.log("Aktywne sesje:", aktywneSesje);
  }, [pizzas, pizzasLoading, pizzasError, pozycjeExtra, extraLoading, skladniki, skladnikiError, aktywneSesje]);

  const calculatePriceMutation = api.pizza.calculatePrice.useMutation();
  const placeOrderMutation = api.pizza.placeOrder.useMutation();

  // Automatycznie ustaw sesję jeśli jest tylko jedna aktywna
  useEffect(() => {
    if (aktywneSesje && aktywneSesje.length === 1) {
      setWybranaSesjaId(aktywneSesje[0].id);
    } else if (aktywneSesje && aktywneSesje.length === 0) {
      setWybranaSesjaId(null);
    }
  }, [aktywneSesje]);

  // Aktualizuj sugestie ulic
  useEffect(() => {
    console.log("Street search data:", searchStreets.data);
    if (searchStreets.data && searchStreets.data.length > 0) {
      // Przechowujemy obiekty z ulicą i dzielnicą
      setStreetSuggestions(searchStreets.data.filter((street: any) => street.ulica));
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1); // Resetuj wybrany indeks
    } else {
      setStreetSuggestions([]);
      if (ulica.length < 3) {
        setShowSuggestions(false);
      }
      setSelectedSuggestionIndex(-1);
    }
  }, [searchStreets.data, ulica]);

  // Aktualizuj informacje o dzielnicy
  useEffect(() => {
    // Query jest włączony tylko dla zamówień z dowozem i gdy są wpisane ulica i numer
    const isQueryEnabled = ulica.length > 0 && numerDomu.length > 0 && typZamowienia === "dowoz";
    
    console.log("dzielnicaInfo useEffect:", {
      isQueryEnabled,
      isFetching: dzielnicaInfo.isFetching,
      hasData: !!dzielnicaInfo.data,
      data: dzielnicaInfo.data,
      ulica,
      numerDomu,
      typZamowienia
    });
    
    if (!isQueryEnabled) {
      // Jeśli query nie jest włączony, nie sprawdzaj adresu
      return;
    }

    // Sprawdzaj tylko gdy query nie jest w trakcie ładowania
    if (dzielnicaInfo.isFetching) {
      return;
    }

    if (dzielnicaInfo.data && dzielnicaInfo.data.dzielnica_nazwa) {
      console.log("Adres znaleziony w bazie:", dzielnicaInfo.data);
      setDzielnicaNazwa(dzielnicaInfo.data.dzielnica_nazwa);
      
      // Sprawdź czy numer domu został znaleziony w bazie
      // @ts-ignore - numerZnaleziony może nie być w typach
      const numerZnaleziony = dzielnicaInfo.data.numerZnaleziony;
      
      // Jeśli użytkownik podał numer, ale nie został znaleziony - pokaż ostrzeżenie
      if (numerDomu && numerZnaleziony === false) {
        console.log("Numer domu nie został znaleziony w bazie - pokazuję ostrzeżenie");
        setAddressNotRecognized(true);
      } else {
        // Numer znaleziony lub nie był wymagany
        setAddressNotRecognized(false);
      }
      
      // Automatycznie ustaw dzielnicę na podstawie danych z bazy (tylko jeśli użytkownik nie zmienił ręcznie)
      if (!userManuallyChangedDzielnica) {
        setMiejscowosc(dzielnicaInfo.data.dzielnica_nazwa);
        setCustomDeliveryPrice(dzielnicaInfo.data.cena_dzielnica);
      } else {
        // Użytkownik ręcznie zmienił dzielnicę - pokaż ostrzeżenie
        setAddressNotRecognized(true);
      }
    } else {
      // Adres nie został znaleziony w bazie
      console.log("Adres NIE znaleziony - ustawiam addressNotRecognized na TRUE");
      setAddressNotRecognized(true);
      setDzielnicaNazwa("");
      if (!userManuallyChangedDzielnica) {
        setCustomDeliveryPrice(null);
      }
    }
  }, [dzielnicaInfo.data, dzielnicaInfo.isFetching, userManuallyChangedDzielnica, ulica, numerDomu, typZamowienia]);

  // Aktualizuj pełny adres przy zmianie pól
  useEffect(() => {
    const addressParts = [ulica, numerDomu];
    if (numerMieszkania) {
      addressParts.push(`m. ${numerMieszkania}`);
    }
    if (dodatkoweInfo) {
      addressParts.push(dodatkoweInfo);
    }
    const fullAddress = addressParts.filter(p => p).join(", ");
    setOrderData(prev => ({ ...prev, adres: fullAddress }));
  }, [ulica, numerDomu, numerMieszkania, dodatkoweInfo]);

  // useQuery automatycznie odpytuje gdy zmienią się parametry (ulica, numerDomu, miejscowosc)

  // Kalkuluj cenę na żywo
  useEffect(() => {
    if (orderData.pizze.length > 0 || orderData.napojeIds.length > 0 || orderData.pozycjeExtraIds.length > 0 || orderData.sosy.pomidorowy > 0 || orderData.sosy.czosnkowy > 0) {
      console.log("Wysyłam do kalkulacji, napojeIds:", orderData.napojeIds);
      
      // Przygotuj modyfikacje składników w formacie: { "0": { "pieczarki": 2, "szynka": 0 }, "1": {...} }
      const modyfikacjeSkladnikow: Record<string, Record<string, number>> = {};
      orderData.pizze.forEach((pizza, index) => {
        if (pizza.modifications && Object.keys(pizza.modifications).length > 0) {
          // Musimy zamienić ID składników na nazwy i obliczyć CAŁKOWITĄ ilość (baza + modyfikacja)
          const modsByName: Record<string, number> = {};
          
          // Pobierz definicję pizzy z bazy aby znać bazowe składniki
          const pizzaDef = pizzas?.find(p => p.id === pizza.id);
          
          Object.entries(pizza.modifications).forEach(([skladnikIdStr, change]) => {
            const skladnikId = parseInt(skladnikIdStr);
            const skladnik = skladniki?.find(s => s.id === skladnikId);
            if (skladnik) {
              // Sprawdź czy składnik jest bazowy w tej pizzy
              const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === skladnikId);
              const baseCount = isBase ? 1 : 0;
              
              // CAŁKOWITA ilość = bazowa + zmiana
              const totalCount = baseCount + change;
              
              // Wysyłaj tylko składniki które faktycznie są (nie usunięte całkowicie)
              if (totalCount > 0) {
                modsByName[skladnik.nazwa] = totalCount;
              }
            }
          });
          
          if (Object.keys(modsByName).length > 0) {
            modyfikacjeSkladnikow[index.toString()] = modsByName;
          }
        }
      });
      
      calculatePriceMutation.mutate({
        pizze: orderData.pizze.map(p => ({ 
          id: p.id, 
          rozmiar: p.rozmiar,
          isKupony: p.isKupony,
          polNaPol: p.polNaPol
        })),
        sosy: orderData.sosy,
        napojeIds: orderData.napojeIds,
        pozycjeExtraIds: orderData.pozycjeExtraIds,
        isKupony: isKupony,
        typZamowienia: typZamowienia,
        adres: orderData.adres,
        customDeliveryPrice: customDeliveryPrice ?? undefined,
        modyfikacjeSkladnikow: Object.keys(modyfikacjeSkladnikow).length > 0 ? modyfikacjeSkladnikow : undefined,
      }, {
        onSuccess: (data) => {
          console.log("Otrzymana cena z backendu:", data);
          setTotalPrice(data.totalPrice);
        },
      });
    } else {
      setTotalPrice(0);
    }
  }, [orderData, isKupony, typZamowienia]);

  const handlePizzaSelect = (pizzaId: number) => {
    const pizza = pizzas?.find((p: any) => p.id === pizzaId);
    if (!pizza) return;

    // Jeśli wybieramy drugą pizzę dla opcji "pół na pół"
    if (showPolNaPolSelector && firstPizzaId) {
      const firstPizza = pizzas?.find((p: any) => p.id === firstPizzaId);
      if (!firstPizza) return;

      // W trybie KUPONY sprawdź czy obie pizze są w pierwszych 13
      if (isKupony) {
        const idx1 = (pizzas || []).findIndex((p: any) => p.id === firstPizzaId);
        const idx2 = (pizzas || []).findIndex((p: any) => p.id === pizzaId);
        if (idx1 < 0 || idx1 >= 13 || idx2 < 0 || idx2 >= 13) return;
      }

      const rozmiar: "mala" | "srednia" | "duza" = currentPizzaSize;
      let cena: number;

      if (isKupony) {
        // W trybie KUPONY: średnia = 0 zł (+ 4 zł pół na pół), duża = 10 zł (+ 4 zł pół na pół)
        const rozmiarKupon: "srednia" | "duza" = currentPizzaSize === "duza" ? "duza" : "srednia";
        cena = (rozmiarKupon === "srednia" ? 0 : 10) + 4;
      } else {
        // Standardowa cena: max z obu pizz + 4 PLN
        cena = Math.max(
          currentPizzaSize === "mala" ? firstPizza.cena_mala : 
          currentPizzaSize === "srednia" ? firstPizza.cena_srednia : 
          firstPizza.cena_duza,
          currentPizzaSize === "mala" ? pizza.cena_mala : 
          currentPizzaSize === "srednia" ? pizza.cena_srednia : 
          pizza.cena_duza
        ) + 4;
      }

      const newPizza: PizzaSelection = {
        id: firstPizza.id,
        nazwa: `${firstPizza.nazwa} / ${pizza.nazwa} (pół na pół)`,
        rozmiar,
        cena,
        isKupony: isKupony,
        polNaPol: {
          id: pizza.id,
          nazwa: pizza.nazwa,
        },
      };

      setOrderData(prev => ({
        ...prev,
        pizze: [...prev.pizze, newPizza],
      }));

      setShowPolNaPolSelector(false);
      setFirstPizzaId(null);
      setIsPolNaPol(false);
      setSelectedPizzas(new Set());
      setCurrentPizzaSize(isKupony ? "srednia" : "mala");
      setShowAddPizza(false);
      return;
    }

    // Jeśli to pierwsza pizza i wybrano opcję "pół na pół"
    if (isPolNaPol) {
      // W trybie KUPONY sprawdź czy pizza jest w pierwszych 13
      if (isKupony) {
        const idx = (pizzas || []).findIndex((p: any) => p.id === pizzaId);
        if (idx < 0 || idx >= 13) return;
      }
      setFirstPizzaId(pizzaId);
      setShowPolNaPolSelector(true);
      return;
    }

    // Tryb KUPONY: dozwolone tylko pierwsze 13 pozycji listy, rozmiar średnia (0 zł) lub duża (+10 zł)
    if (isKupony) {
      const idx = (pizzas || []).findIndex((p: any) => p.id === pizzaId);
      if (idx < 0 || idx >= 13) return;
      const rozmiar: "srednia" | "duza" = currentPizzaSize === "duza" ? "duza" : "srednia";
      const cena = rozmiar === "srednia" ? 0 : 10;
      const newPizza: PizzaSelection = {
        id: pizza.id,
        nazwa: pizza.nazwa,
        rozmiar,
        cena,
        isKupony: true,
      };
      setOrderData(prev => ({
        ...prev,
        pizze: [...prev.pizze, newPizza],
      }));
      setSelectedPizzas(new Set());
      setCurrentPizzaSize("srednia");
      setShowAddPizza(false);
      return;
    }

    // Standardowa pizza
    const newPizza: PizzaSelection = {
      id: pizza.id,
      nazwa: pizza.nazwa,
      rozmiar: currentPizzaSize,
      cena: currentPizzaSize === "mala" ? pizza.cena_mala : 
            currentPizzaSize === "srednia" ? pizza.cena_srednia : 
            pizza.cena_duza,
      isKupony: isKupony,
    };

    setOrderData(prev => ({
      ...prev,
      pizze: [...prev.pizze, newPizza],
    }));

    setSelectedPizzas(new Set());
    setCurrentPizzaSize("mala");
    setShowAddPizza(false);
  };

  const removePizza = (index: number) => {
    setOrderData(prev => ({
      ...prev,
      pizze: prev.pizze.filter((_, i) => i !== index),
    }));
  };

  const handleStreetSelect = (ulicaName: string) => {
    setUlica(ulicaName);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    // Automatycznie przenosimy focus na pole numer domu
    setTimeout(() => {
      numerDomuInputRef.current?.focus();
    }, 0);
  };

  const resetForm = () => {
    setOrderData({
      telefon: "",
      adres: "",
      pizze: [],
      sosy: { pomidorowy: 0, czosnkowy: 0 },
      napojeIds: [],
      pozycjeExtraIds: [],
      platnosc: "gotowka",
    });
    setUlica("");
    setNumerDomu("");
    setNumerMieszkania("");
    setDodatkoweInfo("");
    setTotalPrice(0);
    setSelectedPizzas(new Set());
    setShowSuggestions(false);
    setStreetSuggestions([]);
    setShowAddPizza(false);
    setIsPolNaPol(false);
    setIsKupony(false);
    setShowPolNaPolSelector(false);
    setFirstPizzaId(null);
  };

  const toggleIngredients = (index: number) => {
    if (expandedPizzaIndex === index) {
      setExpandedPizzaIndex(null);
    } else {
      setExpandedPizzaIndex(index);
    }
  };

  const updateIngredient = (pizzaIndex: number, ingredientId: number, change: number) => {
    setOrderData(prev => {
      const newPizze = [...prev.pizze];
      const pizza = newPizze[pizzaIndex];
      if (!pizza) return prev;

      const currentMods = pizza.modifications || {};
      const currentChange = currentMods[ingredientId] || 0;
      const newChange = currentChange + change;

      // Sprawdź czy nie schodzimy poniżej 0 (baza + modyfikacja >= 0)
      // Musimy znaleźć bazową ilość tego składnika w pizzy
      const pizzaDef = pizzas?.find(p => p.id === pizza.id);
      const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === ingredientId);
      const baseCount = isBase ? 1 : 0; // Zakładamy 1 sztukę w bazie

      if (baseCount + newChange < 0) return prev;

      const newMods = { ...currentMods, [ingredientId]: newChange };
      
      // Usuń wpis jeśli zmiana wynosi 0 (powrót do stanu bazowego)
      if (newChange === 0) {
        delete newMods[ingredientId];
      }

      newPizze[pizzaIndex] = { ...pizza, modifications: newMods };
      return { ...prev, pizze: newPizze };
    });
  };

  const generateSkladnikiString = () => {
    if (orderData.pizze.length === 0) return undefined;

    const parts: string[] = [];
    
    orderData.pizze.forEach((pizza, index) => {
      if (!pizza.modifications || Object.keys(pizza.modifications).length === 0) return;

      const pizzaName = pizza.nazwa;
      const mods: string[] = [];

      Object.entries(pizza.modifications).forEach(([idStr, change]) => {
        const id = parseInt(idStr);
        const ingredient = skladniki?.find((s: any) => s.id === id);
        if (!ingredient) return;

        if (change < 0) {
          // Usunięcie
          mods.push(`-${ingredient.nazwa}`);
        } else if (change > 0) {
          // Dodanie
          // Sprawdź czy był w bazie
          const pizzaDef = pizzas?.find(p => p.id === pizza.id);
          const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === id);
          
          if (isBase) {
            mods.push(`${change + 1}+${ingredient.nazwa}`); // np. 2+ananas
          } else {
            if (change === 1) {
              mods.push(`+${ingredient.nazwa}`);
            } else {
              mods.push(`${change}+${ingredient.nazwa}`);
            }
          }
        }
      });

      if (mods.length > 0) {
        parts.push(`${pizzaName}: ${mods.join(", ")}`);
      }
    });

    return parts.length > 0 ? parts.join("; ") : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Walidacja - tylko dla dowozu sprawdzamy telefon i adres
    if (typZamowienia === "dowoz") {
      if (!/^\d{7,11}$/.test(orderData.telefon)) {
        alert("Telefon musi mieć 7-11 cyfr");
        return;
      }
      
      if (!ulica.trim()) {
        alert("Nazwa ulicy jest wymagana");
        return;
      }
      
      if (!numerDomu.trim()) {
        alert("Numer domu jest wymagany");
        return;
      }
    }
    
    if (orderData.pizze.length === 0) {
      alert("Dodaj przynajmniej jedną pizzę");
      return;
    }

    try {
      console.log("Składanie zamówienia:", orderData);
      
      // Przygotuj obiekt modyfikacjeSkladnikow
      const modyfikacjeSkladnikow: Record<string, Record<string, number>> = {};
      orderData.pizze.forEach((pizza, index) => {
        if (pizza.modifications && Object.keys(pizza.modifications).length > 0) {
          const modsByName: Record<string, number> = {};
          const pizzaDef = pizzas?.find(p => p.id === pizza.id);
          
          Object.entries(pizza.modifications).forEach(([skladnikIdStr, change]) => {
            const skladnikId = parseInt(skladnikIdStr);
            const skladnik = skladniki?.find(s => s.id === skladnikId);
            if (skladnik) {
              const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === skladnikId);
              const baseCount = isBase ? 1 : 0;
              const totalCount = baseCount + change;
              
              if (totalCount > 0) {
                modsByName[skladnik.nazwa] = totalCount;
              }
            }
          });
          
          if (Object.keys(modsByName).length > 0) {
            modyfikacjeSkladnikow[index.toString()] = modsByName;
          }
        }
      });
      
      // Sprawdź czy którakolwiek pizza ma isKupony = true
      const hasKupony = orderData.pizze.some(p => p.isKupony === true);
      
      const result = await placeOrderMutation.mutateAsync({
        telefon: orderData.telefon,
        adres: orderData.adres,
        pizze: orderData.pizze.map(p => ({ 
          id: p.id, 
          rozmiar: p.rozmiar,
          isKupony: p.isKupony,
          polNaPol: p.polNaPol
        })),
        sosy: orderData.sosy,
        napojeIds: orderData.napojeIds,
        pozycjeExtraIds: orderData.pozycjeExtraIds,
        platnosc: orderData.platnosc,
        isKupony: hasKupony || isKupony, // true jeśli którakolwiek pizza ma kupony LUB zaznaczony checkbox
        typZamowienia: typZamowienia,
        skladniki: generateSkladnikiString(),
        customDeliveryPrice: customDeliveryPrice ?? undefined,
        sesjaId: (typZamowienia === "dowoz" && wybranaSesjaId) ? wybranaSesjaId : undefined,
        modyfikacjeSkladnikow: Object.keys(modyfikacjeSkladnikow).length > 0 ? modyfikacjeSkladnikow : undefined,
      });

      console.log("Wynik zamówienia:", result);
      
      if (result && result.success) {
        alert(`✅ Zamówienie złożone pomyślnie! Cena: ${result.cenaCalkwita} PLN`);
        resetForm();
      } else {
        alert("❌ Błąd podczas składania zamówienia");
      }
      
    } catch (error) {
      console.error("Szczegółowy błąd zamówienia:", error);
      if (error instanceof Error) {
        alert(`❌ Błąd: ${error.message}`);
      } else {
        alert("❌ Błąd podczas składania zamówienia. Spróbuj ponownie.");
      }
    }
  };

  return (
    <>
      <Head>
        <title>SmartPizzApp - Zamów Pizzę</title>
        <meta name="description" content="Aplikacja do zamawiania pizzy" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="mb-8 text-center text-4xl font-bold text-gray-800">
            🍕 SmartPizzApp
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-lg">
            {/* Wybór typu zamówienia */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Typ zamówienia
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTypZamowienia("na_miejscu")}
                  className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                    typZamowienia === "na_miejscu"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  🍽️ Na miejscu
                </button>
                <button
                  type="button"
                  onClick={() => setTypZamowienia("na_wynos")}
                  className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                    typZamowienia === "na_wynos"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  🛍️ Na wynos
                </button>
                <button
                  type="button"
                  onClick={() => setTypZamowienia("dowoz")}
                  className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                    typZamowienia === "dowoz"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  🚗 Dowóz
                </button>
              </div>
            </div>

            {/* Dane kontaktowe - tylko dla dowozu */}
            {typZamowienia === "dowoz" && (
              <div className="space-y-4">
                {/* Telefon */}
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon (7-11 cyfr)
                </label>
                <input
                  type="tel"
                  value={orderData.telefon.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  onChange={(e) => {
                    const cleanedValue = e.target.value.replace(/\s/g, '');
                    setOrderData(prev => ({ ...prev, telefon: cleanedValue }));
                  }}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="123 456 789"
                  required
                />
              </div>

              {/* Adres dostawy - 3 pola */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres dostawy
                </label>
                {/* Klaster/Dzielnica */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dzielnica
                  </label>
                  <select
                    value={miejscowosc}
                    onChange={(e) => {
                      const newMiejscowosc = e.target.value;
                      setMiejscowosc(newMiejscowosc);
                      // Oznacz że użytkownik ręcznie zmienił dzielnicę
                      setUserManuallyChangedDzielnica(true);
                      setAddressNotRecognized(true);
                      // Reset ceny przy ręcznej zmianie dzielnicy
                      setCustomDeliveryPrice(null);
                    }}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Wybierz dzielnicę --</option>
                    <option value="Południe">Południe (0 PLN)</option>
                    <option value="Kazimierza Wlk.-Śródmieście">Kazimierza Wlk.-Śródmieście (5 PLN)</option>
                    <option value="Michelin">Michelin (5 PLN)</option>
                    <option value="Zazamcze">Zazamcze (5 PLN)</option>
                    <option value="Płocka">Płocka (7 PLN)</option>
                    <option value="Zawiśle">Zawiśle (7 PLN)</option>
                    <option value="Nowa Wieś">Nowa Wieś (10 PLN)</option>
                    <option value="Rybnica">Rybnica (10 PLN)</option>
                    <option value="Szpetal Górny">Szpetal Górny (10 PLN)</option>
                    <option value="Toruńska-Anwil">Toruńska-Anwil (10 PLN)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Ulica z podpowiedziami */}
                  <div className="relative md:col-span-2">
                    <input
                      type="text"
                      value={ulica}
                      onChange={(e) => {
                        setUlica(e.target.value);
                        // Reset dzielnicy przy zmianie ulicy - aby backend szukał we wszystkich dzielnicach
                        setMiejscowosc("");
                        setUserManuallyChangedDzielnica(false);
                      }}
                      onFocus={() => {
                        // Pokaż sugestie tylko jeśli użytkownik wpisuje coś nowego
                        if (ulica.length >= 3 && streetSuggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        // Ukryj sugestie po opuszczeniu pola (z małym opóźnieniem dla kliknięć)
                        setTimeout(() => {
                          setShowSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                        }, 200);
                      }}
                      onKeyDown={(e) => {
                        if (!showSuggestions || streetSuggestions.length === 0) return;
                        
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          // Przejść do następnej sugestii
                          setSelectedSuggestionIndex((prev) => {
                            const next = prev + 1;
                            return next >= streetSuggestions.length ? 0 : next;
                          });
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedSuggestionIndex((prev) => {
                            const next = prev + 1;
                            return next >= streetSuggestions.length ? 0 : next;
                          });
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedSuggestionIndex((prev) => {
                            const next = prev - 1;
                            return next < 0 ? streetSuggestions.length - 1 : next;
                          });
                        } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                          e.preventDefault();
                          const selected = streetSuggestions[selectedSuggestionIndex];
                          if (selected) handleStreetSelect(selected.ulica);
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Nazwa ulicy..."
                      required
                    />
                    {showSuggestions && streetSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-96 overflow-y-auto">
                        {streetSuggestions.map((street, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleStreetSelect(street.ulica)}
                            className={`w-full text-left px-3 py-2 transition-colors flex justify-between items-center ${
                              index === selectedSuggestionIndex
                                ? 'bg-blue-50 border-2 border-blue-400 border-opacity-50'
                                : 'hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            <span className="font-medium">{street.ulica}</span>
                            <span className="text-sm text-gray-500 ml-2">({street.dzielnica_nazwa})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Numer */}
                  <div>
                    <input
                      ref={numerDomuInputRef}
                      type="text"
                      value={numerDomu}
                      onChange={(e) => {
                        setNumerDomu(e.target.value);
                        // Reset dzielnicy przy zmianie numeru - aby backend szukał we wszystkich dzielnicach
                        setMiejscowosc("");
                        setUserManuallyChangedDzielnica(false);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Numer"
                      required
                    />
                  </div>
                  
                  {/* Mieszkanie */}
                  <div>
                    <input
                      type="text"
                      value={numerMieszkania}
                      onChange={(e) => setNumerMieszkania(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Mieszkanie"
                    />
                  </div>
                </div>

                {/* Dodatkowe informacje */}
                <div className="mt-3">
                  <input
                    type="text"
                    value={dodatkoweInfo}
                    onChange={(e) => setDodatkoweInfo(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Dodatkowe informacje (np. piętro, kod domofonu)"
                  />
                </div>

                {/* Informacja o dzielnicy i cena dostawy - zawsze widoczne dla dowozu */}
                {typZamowienia === "dowoz" && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">Dowóz: </span>
                        <span className="text-sm font-semibold text-blue-700">
                          {dzielnicaNazwa || miejscowosc || "nie rozpoznano"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Cena dostawy:</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={customDeliveryPrice ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setCustomDeliveryPrice(null);
                            } else {
                              setCustomDeliveryPrice(parseInt(value) || 0);
                            }
                          }}
                          className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                        <span className="text-sm font-medium text-gray-700">PLN</span>
                      </div>
                    </div>
                    
                    {/* Ostrzeżenie gdy adres nie został rozpoznany */}
                    {addressNotRecognized && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300 rounded-md">
                        <p className="text-sm font-semibold text-yellow-800">⚠️ UWAGA! Adres nie został rozpoznany.</p>
                        <p className="text-sm text-yellow-700">Cena musi zostać wprowadzona ręcznie.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Wybrane pizze */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Wybrane pizze</h3>
              {orderData.pizze.map((pizza, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded mb-2">
                  <div className="flex justify-between items-center">
                    <span>{pizza.nazwa} - {pizza.rozmiar} ({pizza.cena} PLN)</span>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleIngredients(index)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {expandedPizzaIndex === index ? "Ukryj składniki" : "Edytuj składniki"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePizza(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                  
                  {/* Edytor składników */}
                  {expandedPizzaIndex === index && (
                    <div className="mt-3 border-t pt-3">
                      <h4 className="text-sm font-semibold mb-2">Modyfikuj składniki:</h4>
                      {skladnikiLoading && <div className="text-sm text-gray-500">Ładowanie składników...</div>}
                      {skladnikiError && <div className="text-sm text-red-500">Błąd: {skladnikiError.message}</div>}
                      {!skladnikiLoading && !skladnikiError && (!skladniki || skladniki.length === 0) && (
                        <div className="text-sm text-gray-500">Brak dostępnych składników.</div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {skladniki?.map((skladnik: any) => {
                          // Sprawdź czy składnik jest w bazie pierwszej pizzy
                          const pizzaDef = pizzas?.find(p => p.id === pizza.id);
                          const isBaseInFirst = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === skladnik.id);
                          
                          // Sprawdź czy składnik jest w bazie drugiej pizzy (dla pół na pół)
                          let isBaseInSecond = false;
                          if (pizza.polNaPol) {
                            const pizzaDef2 = pizzas?.find(p => p.id === pizza.polNaPol?.id);
                            isBaseInSecond = pizzaDef2?.skladniki?.some((s: any) => s.id_skladnik === skladnik.id) || false;
                          }
                          
                          // Składnik jest bazowy jeśli jest w którejkolwiek z pizz
                          const isBase = isBaseInFirst || isBaseInSecond;
                          const baseCount = isBase ? 1 : 0;
                          const modification = pizza.modifications?.[skladnik.id] || 0;
                          const currentCount = baseCount + modification;
                          
                          // Pokaż tylko jeśli jest w bazie LUB został dodany LUB (opcjonalnie: pokaż wszystkie)
                          // Użytkownik chce listę checkboxów ze składnikami zawartymi w każdej pizzy...
                          // Ale też chce dodawać inne. Więc pokazujemy wszystkie, ale wyróżniamy te bazowe.
                          
                          return (
                            <div key={skladnik.id} className={`flex items-center justify-between p-2 rounded border ${
                              currentCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                            }`}>
                              <span className="text-sm truncate mr-2" title={skladnik.nazwa}>
                                {skladnik.nazwa}
                              </span>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => updateIngredient(index, skladnik.id, -1)}
                                  disabled={currentCount <= 0}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                                >
                                  -
                                </button>
                                <span className="w-4 text-center text-sm font-medium">{currentCount}</span>
                                <button
                                  type="button"
                                  onClick={() => updateIngredient(index, skladnik.id, 1)}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {!showAddPizza && (
                <button
                  type="button"
                  onClick={() => setShowAddPizza(true)}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600"
                >
                  + Dodaj pizzę
                </button>
              )}
            </div>

            {/* Menu pizz */}
            {showAddPizza && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {showPolNaPolSelector 
                    ? "Wybierz drugą pizzę (pół na pół)"
                    : isPolNaPol 
                      ? "Wybierz pierwszą pizzę (pół na pół)"
                      : "Wybierz pizzę"
                  }
                </h3>
                
                {/* Wybór rozmiaru */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rozmiar</label>
                  <div className="flex gap-3">
                    {isKupony ? (
                      <>
                        <label 
                          className={`flex-1 cursor-pointer transition-all ${
                            currentPizzaSize === "srednia" 
                              ? 'bg-blue-500 text-white border-blue-500' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          } border rounded-lg px-4 py-3 text-center font-medium`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value="srednia"
                            checked={currentPizzaSize === "srednia"}
                            onChange={() => setCurrentPizzaSize("srednia")}
                            className="hidden"
                          />
                          Średnia (0 zł)
                        </label>
                        <label 
                          className={`flex-1 cursor-pointer transition-all ${
                            currentPizzaSize === "duza" 
                              ? 'bg-blue-500 text-white border-blue-500' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          } border rounded-lg px-4 py-3 text-center font-medium`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value="duza"
                            checked={currentPizzaSize === "duza"}
                            onChange={() => setCurrentPizzaSize("duza")}
                            className="hidden"
                          />
                          Duża (+10 zł)
                        </label>
                      </>
                    ) : (
                      [
                        { key: "mala", label: "Mała" },
                        { key: "srednia", label: "Średnia" },
                        { key: "duza", label: "Duża" }
                      ].map(size => (
                        <label 
                          key={size.key} 
                          className={`flex-1 cursor-pointer transition-all ${
                            currentPizzaSize === size.key 
                              ? 'bg-blue-500 text-white border-blue-500' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          } border rounded-lg px-4 py-3 text-center font-medium`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value={size.key}
                            checked={currentPizzaSize === size.key}
                            onChange={(e) => setCurrentPizzaSize(e.target.value as "mala" | "srednia" | "duza")}
                            className="hidden"
                          />
                          {size.label}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex space-x-8">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isPolNaPol}
                        onChange={(e) => setIsPolNaPol(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Pół na pół (+4 PLN)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isKupony}
                        onChange={(e) => setIsKupony(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        KUPONY
                      </span>
                    </label>
                  </div>
                </div>

                {/* Siatka pizz */}
                {pizzasLoading && <div className="text-center py-4">Ładowanie pizz...</div>}
                {pizzasError && <div className="text-red-500 text-center py-4">Błąd: {pizzasError.message}</div>}
                {!pizzasLoading && !pizzasError && (!pizzas || pizzas.length === 0) && (
                  <div className="text-center py-4 text-gray-500">Brak dostępnych pizz w bazie danych</div>
                )}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {(isKupony ? pizzas?.slice(0, 13) : pizzas?.slice(0, 40))
                    ?.map((pizza: any) => (
                      <button
                        key={pizza.id}
                        type="button"
                        onClick={() => handlePizzaSelect(pizza.id)}
                        className={`p-4 border-2 rounded-lg text-center hover:border-blue-500 transition-colors ${
                          selectedPizzas.has(pizza.id) || firstPizzaId === pizza.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                      >
                        <div className="text-xs font-medium mb-2">{pizza.nazwa}</div>
                        <div className="text-xs text-gray-600">
                          {isKupony ? (
                            currentPizzaSize === "srednia" ? "" : currentPizzaSize === "duza" ? "10 zł" : ""
                          ) : (
                            currentPizzaSize === "mala" ? `${pizza.cena_mala} PLN` :
                            currentPizzaSize === "srednia" ? `${pizza.cena_srednia} PLN` :
                            `${pizza.cena_duza} PLN`
                          )}
                        </div>
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPizza(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Anuluj
                </button>
              </div>
            )}

            {/* Sosy */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sosy (2 PLN/szt)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sos pomidorowy
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pomidorowy: Math.max(0, prev.sosy.pomidorowy - 1) }
                      }))}
                      className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xl font-bold text-gray-700 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={orderData.sosy.pomidorowy}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pomidorowy: parseInt(e.target.value) || 0 }
                      }))}
                      className="flex-1 p-3 border border-gray-300 rounded-md text-center font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pomidorowy: prev.sosy.pomidorowy + 1 }
                      }))}
                      className="w-12 h-12 flex items-center justify-center bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-lg text-xl font-bold text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sos czosnkowy
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czosnkowy: Math.max(0, prev.sosy.czosnkowy - 1) }
                      }))}
                      className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xl font-bold text-gray-700 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={orderData.sosy.czosnkowy}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czosnkowy: parseInt(e.target.value) || 0 }
                      }))}
                      className="flex-1 p-3 border border-gray-300 rounded-md text-center font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czosnkowy: prev.sosy.czosnkowy + 1 }
                      }))}
                      className="w-12 h-12 flex items-center justify-center bg-blue-500 hover:bg-blue-600 border border-blue-500 rounded-lg text-xl font-bold text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pozycje extra */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Pozycje extra (opcjonalnie)</h3>
              {extraLoading && <div className="text-center py-4">Ładowanie pozycji extra...</div>}
              {!extraLoading && (!pozycjeExtra || pozycjeExtra.length === 0) && (
                <div className="text-center py-4 text-gray-500">Brak dostępnych pozycji extra</div>
              )}
              <div className="space-y-2">
                {pozycjeExtra?.map((extra: any) => (
                  <label key={extra.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={orderData.pozycjeExtraIds.includes(extra.id)}
                      onChange={(e) => {
                        setOrderData(prev => ({
                          ...prev,
                          pozycjeExtraIds: e.target.checked
                            ? [...prev.pozycjeExtraIds, extra.id]
                            : prev.pozycjeExtraIds.filter(id => id !== extra.id)
                        }));
                      }}
                      className="mr-2"
                    />
                    <span>{extra.nazwa} - {extra.cena} PLN</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Napoje */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Napoje (opcjonalnie)
              </label>
              <div className="space-y-3">
                {orderData.napojeIds.map((napojId, index) => {
                  const wybranyNapoj = napoje?.find((n: any) => n.id === napojId);
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={napojId}
                        onChange={(e) => {
                          const newNapojeIds = [...orderData.napojeIds];
                          newNapojeIds[index] = parseInt(e.target.value);
                          setOrderData(prev => ({ ...prev, napojeIds: newNapojeIds }));
                        }}
                        className="flex-1 p-3 border border-gray-300 rounded-md"
                      >
                        {napoje?.map((napoj: any) => (
                          <option key={napoj.id} value={napoj.id}>
                            {napoj.nazwa} - {napoj.cena} PLN
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const newNapojeIds = orderData.napojeIds.filter((_, i) => i !== index);
                          setOrderData(prev => ({ ...prev, napojeIds: newNapojeIds }));
                        }}
                        className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium transition-colors"
                      >
                        Usuń
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (napoje && napoje.length > 0) {
                      // Znajdź napój "0,85" (priorytet) lub "85" jako domyślny
                      const napoj085 = napoje.find((n: any) => n.nazwa.includes("0,85") || n.nazwa.includes("0.85") || (n.nazwa.includes("napoje") && n.cena === 10));
                      const defaultNapojId = napoj085 ? napoj085.id : napoje[0].id;
                      setOrderData(prev => ({ 
                        ...prev, 
                        napojeIds: [...prev.napojeIds, defaultNapojId] 
                      }));
                    }
                  }}
                  className="w-full p-3 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium transition-colors"
                >
                  + Dodaj napój
                </button>
              </div>
            </div>

            {/* Płatność */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Płatność</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="platnosc"
                    value="gotowka"
                    checked={orderData.platnosc === "gotowka"}
                    onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" }))}
                    className="mr-2"
                  />
                  Gotówka
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="platnosc"
                    value="karta"
                    checked={orderData.platnosc === "karta"}
                    onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" }))}
                    className="mr-2"
                  />
                  Karta
                </label>
              </div>
            </div>

            {/* Wybór kierowcy */}
            {!sesjeLoading && aktywneSesje && aktywneSesje.length > 0 && typZamowienia === "dowoz" && (
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {aktywneSesje.length === 1 ? "🚗 Kierowca:" : "🚗 Wybierz kierowcę:"}
                </label>
                {aktywneSesje.length === 1 ? (
                  <div className="text-lg font-semibold text-blue-700 text-center p-2">
                    {aktywneSesje[0].kierowca.nazwa}
                  </div>
                ) : (
                  <select
                    value={wybranaSesjaId ?? ""}
                    onChange={(e) => setWybranaSesjaId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                  >
                    <option value="">-- Wybierz kierowcę --</option>
                    {aktywneSesje.map((sesja: any) => (
                      <option key={sesja.id} value={sesja.id}>
                        {sesja.kierowca.nazwa}
                      </option>
                    ))}
                  </select>
                )}
                {orderData.platnosc === "gotowka" && (
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    💰 Płatność gotówką zostanie automatycznie dodana jako wpływ do sesji kierowcy
                  </p>
                )}
              </div>
            )}

            {/* Podsumowanie ceny */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-center">
                Cena całkowita: {totalPrice.toFixed(2)} PLN
              </div>
            </div>

            {/* Przyciski akcji */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={placeOrderMutation.isLoading || orderData.pizze.length === 0}
                className="w-full bg-green-600 text-white py-4 px-6 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {placeOrderMutation.isLoading ? "Składanie zamówienia..." : "🍕 Złóż zamówienie"}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
              >
                🗑️ Wyczyść formularz
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}