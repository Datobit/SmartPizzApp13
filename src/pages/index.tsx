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
    pom: number;
    czos: number;
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
    sosy: { pom: 0, czos: 0 },
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
  const [previousUlica, setPreviousUlica] = useState("");
  const [showPolNaPolSelector, setShowPolNaPolSelector] = useState(false);
  const [firstPizzaId, setFirstPizzaId] = useState<number | null>(null);
  const [expandedPizzaIndex, setExpandedPizzaIndex] = useState<number | null>(null);
  const [dzielnicaNazwa, setDzielnicaNazwa] = useState<string>("");
  const [customDeliveryPrice, setCustomDeliveryPrice] = useState<number | null>(null);
  const [userManuallyChangedDzielnica, setUserManuallyChangedDzielnica] = useState(false);
  const [addressNotRecognized, setAddressNotRecognized] = useState(false);
  const [wybranaSesjaId, setWybranaSesjaId] = useState<number | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeInputRef, setActiveInputRef] = useState<React.RefObject<HTMLInputElement> | null>(null);
  const [keyboardType, setKeyboardType] = useState<'text' | 'numeric'>('text');
  const [capsLock, setCapsLock] = useState(false);
  const [showPolishChars, setShowPolishChars] = useState(false);
  
  const numerDomuInputRef = useRef<HTMLInputElement>(null);
  const telefonInputRef = useRef<HTMLInputElement>(null);
  const ulicaInputRef = useRef<HTMLInputElement>(null);
  const mieszkanieInputRef = useRef<HTMLInputElement>(null);
  const dodatkoweInfoInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: pizzas, isLoading: pizzasLoading, error: pizzasError } = api.pizza.getAllPizzas.useQuery();
  const { data: napoje, isLoading: napojeLoading } = api.pizza.getAllNapoje.useQuery();
  const { data: pozycjeExtra, isLoading: extraLoading } = api.pizza.getAllPozycjeExtra.useQuery();
  const { data: skladniki, isLoading: skladnikiLoading, error: skladnikiError } = api.pizza.getAllSkladniki.useQuery();
  const { data: aktywneSesje, isLoading: sesjeLoading } = api.pizza.getAktywneSesje.useQuery();

  const searchStreets = api.pizza.searchUlice.useQuery(
    { query: ulica },
    { enabled: ulica.length > 2 && ulica !== previousUlica }
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
      // Pokazuj ostrzeżenie tylko gdy użytkownik wpisał wystarczająco dużo danych
      // (co najmniej 3 znaki ulicy i numer domu - aby nie pokazywać podczas wpisywania)
      if (ulica.length >= 3 && numerDomu.length >= 1) {
        console.log("Adres NIE znaleziony - ustawiam addressNotRecognized na TRUE");
        setAddressNotRecognized(true);
        setDzielnicaNazwa("");
        if (!userManuallyChangedDzielnica) {
          setCustomDeliveryPrice(null);
        }
      } else {
        // Użytkownik jeszcze wpisuje - nie pokazuj ostrzeżenia
        setAddressNotRecognized(false);
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
    if (orderData.pizze.length > 0 || orderData.napojeIds.length > 0 || orderData.pozycjeExtraIds.length > 0 || orderData.sosy.pom > 0 || orderData.sosy.czos > 0) {
      console.log("Wysyłam do kalkulacji, napojeIds:", orderData.napojeIds);
      
      // Przygotuj modyfikacje składników w formacie: { "0": { "pieczarki": 2, "szynka": 0 }, "1": {...} }
      const modyfikacjeSkladnikow: Record<string, Record<string, number>> = {};
      orderData.pizze.forEach((pizza, index) => {
        if (pizza.modifications && Object.keys(pizza.modifications).length > 0) {
          // Musimy zamienić ID składników na nazwy i obliczyć CAŁKOWITĄ ilość (baza + modyfikacja)
          const modsByName: Record<string, number> = {};
          
          // Pobierz definicję pizzy z bazy aby znać bazowe składniki
          const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
          
          Object.entries(pizza.modifications).forEach(([skladnikIdStr, change]) => {
            const skladnikId = parseInt(skladnikIdStr);
            const skladnik = skladniki?.find((s: any) => s.id === skladnikId);
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
    setCurrentPizzaSize("duza");
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
      sosy: { pom: 0, czos: 0 },
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
      const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
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
          const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
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
      if (!orderData.telefon.trim()) {
        alert("Numer telefonu jest wymagany");
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
      console.log("Sosy przed wysłaniem:", orderData.sosy);
      
      // Przygotuj obiekt modyfikacjeSkladnikow
      const modyfikacjeSkladnikow: Record<string, Record<string, number>> = {};
      orderData.pizze.forEach((pizza, index) => {
        if (pizza.modifications && Object.keys(pizza.modifications).length > 0) {
          const modsByName: Record<string, number> = {};
          const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
          
          Object.entries(pizza.modifications).forEach(([skladnikIdStr, change]) => {
            const skladnikId = parseInt(skladnikIdStr);
            const skladnik = skladniki?.find((s: any) => s.id === skladnikId);
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
        alert(` Zamówienie złożone pomyślnie! Cena: ${result.cenaCalkwita} PLN`);
        resetForm();
      } else {
        alert(" Błąd podczas składania zamówienia");
      }
      
    } catch (error) {
      console.error("Szczegółowy błąd zamówienia:", error);
      if (error instanceof Error) {
        alert(` Błąd: ${error.message}`);
      } else {
        alert(" Błąd podczas składania zamówienia. Spróbuj ponownie.");
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

      <main className="min-h-screen bg-gray-50 py-4">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight" style={{ marginLeft: '30px' }}>
              SmartPizzApp
            </h1>
            <div className="flex gap-2">
              <a
                href="http://localhost:3006"
                className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-orange-700 hover:to-orange-800 shadow-lg hover:shadow-xl transition-all"
              >
                Orders Viewer
              </a>
              <a
                href="http://localhost:3006/kuchnia"
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all"
              >
                🍳 Kuchnia
              </a>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow-xl border border-gray-100">
            {/* Wybór typu zamówienia */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                Typ zamówienia
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTypZamowienia("na_miejscu")}
                  className={`p-3 rounded-lg border-2 font-bold transition-all text-sm ${
                    typZamowienia === "na_miejscu"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-lg scale-105"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:shadow-md"
                  }`}
                >
                  Na miejscu
                </button>
                <button
                  type="button"
                  onClick={() => setTypZamowienia("na_wynos")}
                  className={`p-3 rounded-lg border-2 font-bold transition-all text-sm ${
                    typZamowienia === "na_wynos"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-lg scale-105"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:shadow-md"
                  }`}
                >
                  Na wynos
                </button>
                <button
                  type="button"
                  onClick={() => setTypZamowienia("dowoz")}
                  className={`p-3 rounded-lg border-2 font-bold transition-all text-sm ${
                    typZamowienia === "dowoz"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-lg scale-105"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:shadow-md"
                  }`}
                >
                  Dowóz
                </button>
              </div>
            </div>

            {/* Dane kontaktowe - tylko dla dowozu */}
            {typZamowienia === "dowoz" && (
              <div>
                {/* Telefon */}
                <div className="mb-2">
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                  Telefon
                </label>
                <input
                  ref={telefonInputRef}
                  type="tel"
                  value={orderData.telefon.replace(/(\d{3})(?=\d)/g, '$1 ')}
                  onChange={(e) => {
                    const cleanedValue = e.target.value.replace(/\s/g, '');
                    setOrderData(prev => ({ ...prev, telefon: cleanedValue }));
                  }}
                  onFocus={(e) => {
                    if (!showKeyboard || activeInputRef?.current !== telefonInputRef.current) {
                      setActiveInputRef(telefonInputRef);
                      setKeyboardType('numeric');
                      setShowKeyboard(true);
                    }
                    // Ustaw kursor na końcu tekstu
                    const input = e.target;
                    setTimeout(() => {
                      input.setSelectionRange(input.value.length, input.value.length);
                    }, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  placeholder="123 456 789"
                  required
                />
              </div>

              {/* Adres dostawy - 3 wiersze */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                  Adres dostawy
                </label>
                
                {/* Wiersz 1: Dzielnica | Dodatkowe informacje */}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  {/* Dzielnica */}
                  <div>
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
                      className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-all"
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

                  {/* Dodatkowe informacje */}
                  <div>
                    <input
                      ref={dodatkoweInfoInputRef}
                      type="text"
                      value={dodatkoweInfo}
                      onChange={(e) => setDodatkoweInfo(e.target.value)}
                      onFocus={(e) => {
                        if (!showKeyboard || activeInputRef?.current !== dodatkoweInfoInputRef.current) {
                          setActiveInputRef(dodatkoweInfoInputRef);
                          setKeyboardType('text');
                          setShowKeyboard(true);
                        }
                        // Ustaw kursor na końcu tekstu
                        const input = e.target;
                        setTimeout(() => {
                          input.setSelectionRange(input.value.length, input.value.length);
                        }, 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                      placeholder="Dodatkowe informacje (np. piętro, kod domofonu)"
                    />
                  </div>
                </div>

                {/* Wiersz 2: Ulica / Nr / Mieszkanie */}
                <div className="flex gap-1.5 mb-1.5">
                    {/* Ulica - 75% szerokości */}
                    <div className="relative flex-[3]">
                      <input
                        ref={ulicaInputRef}
                        type="text"
                        value={ulica}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setPreviousUlica(ulica); // Zapisz poprzednią wartość przed zmianą
                          setUlica(newValue);
                          // Reset dzielnicy przy zmianie ulicy - aby backend szukał we wszystkich dzielnicach
                          setMiejscowosc("");
                          setUserManuallyChangedDzielnica(false);
                          
                          // Pokaż sugestie tylko gdy użytkownik edytuje (wpisuje coś)
                          if (newValue.length >= 3 && streetSuggestions.length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                        onFocus={(e) => {
                          if (!showKeyboard || activeInputRef?.current !== ulicaInputRef.current) {
                            setActiveInputRef(ulicaInputRef);
                            setKeyboardType('text');
                            setShowKeyboard(true);
                          }
                          // Ustaw kursor na końcu tekstu
                          const input = e.target;
                          setTimeout(() => {
                            input.setSelectionRange(input.value.length, input.value.length);
                          }, 0);
                          // Nie pokazuj sugestii automatycznie przy fokusie - tylko przy edycji
                        }}
                        onBlur={() => {
                          // Nie ukrywaj sugestii gdy klawiatura ekranowa jest widoczna
                          if (!showKeyboard) {
                            setTimeout(() => {
                              setShowSuggestions(false);
                              setSelectedSuggestionIndex(-1);
                            }, 200);
                          }
                        }}
                        onKeyDown={(e) => {
                          // Zawsze zapobiegaj submitowi formularza przy Enter
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                          
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
                            const selected = streetSuggestions[selectedSuggestionIndex];
                            if (selected) handleStreetSelect(selected.ulica);
                          } else if (e.key === 'Escape') {
                            setShowSuggestions(false);
                            setSelectedSuggestionIndex(-1);
                          }
                        }}
                        className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                        placeholder="Ulica"
                        required
                      />
                      {showSuggestions && streetSuggestions.length > 0 && (
                        <div 
                          className="absolute z-[60] w-full bg-white border-2 border-gray-200 rounded-lg shadow-2xl bottom-full mb-1 max-h-60 overflow-y-auto"
                          onMouseDown={(e) => {
                            // Zapobiegaj blur na input gdy klikamy w sugestie
                            e.preventDefault();
                          }}
                        >
                          {streetSuggestions.map((street, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleStreetSelect(street.ulica)}
                              className={`w-full text-left px-3 py-2 transition-all flex justify-between items-center ${
                                index === selectedSuggestionIndex
                                  ? 'bg-blue-50 border-2 border-blue-400'
                                  : 'hover:bg-gray-50 border-2 border-transparent'
                              }`}
                            >
                              <span className="font-semibold text-gray-900 text-sm">{street.ulica}</span>
                              <span className="text-xs text-gray-600 ml-2">({street.dzielnica_nazwa})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Numer - 25% szerokości */}
                    <div className="flex-1">
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
                        onFocus={(e) => {
                          if (!showKeyboard || activeInputRef?.current !== numerDomuInputRef.current) {
                            setActiveInputRef(numerDomuInputRef);
                            setKeyboardType('text');
                            setShowKeyboard(true);
                          }
                          // Ustaw kursor na końcu tekstu
                          const input = e.target;
                          setTimeout(() => {
                            input.setSelectionRange(input.value.length, input.value.length);
                          }, 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                        placeholder="Nr"
                        required
                      />
                    </div>

                    {/* Mieszkanie */}
                    <div className="flex-1">
                      <input
                        ref={mieszkanieInputRef}
                        type="text"
                        value={numerMieszkania}
                        onChange={(e) => setNumerMieszkania(e.target.value)}
                        onFocus={(e) => {
                          if (!showKeyboard || activeInputRef?.current !== mieszkanieInputRef.current) {
                            setActiveInputRef(mieszkanieInputRef);
                            setKeyboardType('text');
                            setShowKeyboard(true);
                          }
                          // Ustaw kursor na końcu tekstu
                          const input = e.target;
                          setTimeout(() => {
                            input.setSelectionRange(input.value.length, input.value.length);
                          }, 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className="w-full p-1.5 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                        placeholder="Mieszkanie"
                      />
                    </div>
                  </div>

                {/* On-Screen Keyboard - inline widget - tuż pod polami tekstowymi */}
                {showKeyboard && (
                  <div className="bg-gray-700 p-3 rounded-xl shadow-xl border-2 border-gray-600 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white text-sm font-semibold">Klawiatura</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowKeyboard(false);
                          setShowSuggestions(false);
                        }}
                        className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
                      >
                        
                      </button>
                    </div>
                    
                    {keyboardType === 'numeric' ? (
                      // Numeric keyboard (for telefon) - matching text keyboard size
                      <div className="space-y-1">
                        {/* Rows 1-3: Numbers 1-9 */}
                        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rowIndex) => (
                          <div key={rowIndex} className="grid grid-cols-3 gap-1">
                            {row.map((key) => (
                              <button
                                type="button"
                                key={key}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (activeInputRef?.current) {
                                    const input = activeInputRef.current;
                                    const start = input.selectionStart || 0;
                                    const end = input.selectionEnd || 0;
                                    
                                    if (input === telefonInputRef.current) {
                                      // Pracuj na czystej wartości (bez spacji)
                                      const currentCleanValue = orderData.telefon;
                                      // Oblicz pozycję kursora w czystym stringu (usuń spacje przed kursorem)
                                      const cleanCursorPos = input.value.substring(0, start).replace(/\s/g, '').length;
                                      // Dodaj cyfrę w odpowiednim miejscu czystego stringu
                                      const newCleanValue = currentCleanValue.substring(0, cleanCursorPos) + key + currentCleanValue.substring(cleanCursorPos);
                                      setOrderData(prev => ({ ...prev, telefon: newCleanValue }));
                                      
                                      // Oblicz nową pozycję kursora w sformatowanym stringu
                                      requestAnimationFrame(() => {
                                        const newCleanCursorPos = cleanCursorPos + 1;
                                        // Policz ile spacji będzie przed nową pozycją kursora
                                        const spacesBeforeCursor = Math.floor((newCleanCursorPos - 1) / 3);
                                        const newFormattedCursorPos = newCleanCursorPos + spacesBeforeCursor;
                                        input.setSelectionRange(newFormattedCursorPos, newFormattedCursorPos);
                                      });
                                    } else if (input === numerDomuInputRef.current) {
                                      const newValue = input.value.substring(0, start) + key + input.value.substring(end);
                                      setNumerDomu(newValue);
                                      
                                      requestAnimationFrame(() => {
                                        input.setSelectionRange(start + 1, start + 1);
                                      });
                                    }
                                  }
                                }}
                                className="bg-gray-600 text-white p-3 rounded-lg text-xl font-semibold hover:bg-gray-500 active:bg-gray-400"
                              >
                                {key}
                              </button>
                            ))}
                          </div>
                        ))}
                        
                        {/* Row 4: 0 and Del */}
                        <div className="grid grid-cols-3 gap-1">
                          <div></div>
                          {/* 0 button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                const end = input.selectionEnd || 0;
                                
                                if (input === telefonInputRef.current) {
                                  const currentCleanValue = orderData.telefon;
                                  const cleanCursorPos = input.value.substring(0, start).replace(/\s/g, '').length;
                                  const newCleanValue = currentCleanValue.substring(0, cleanCursorPos) + '0' + currentCleanValue.substring(cleanCursorPos);
                                  setOrderData(prev => ({ ...prev, telefon: newCleanValue }));
                                  
                                  requestAnimationFrame(() => {
                                    const newCleanCursorPos = cleanCursorPos + 1;
                                    const spacesBeforeCursor = Math.floor((newCleanCursorPos - 1) / 3);
                                    const newFormattedCursorPos = newCleanCursorPos + spacesBeforeCursor;
                                    input.setSelectionRange(newFormattedCursorPos, newFormattedCursorPos);
                                  });
                                } else if (input === numerDomuInputRef.current) {
                                  const newValue = input.value.substring(0, start) + '0' + input.value.substring(end);
                                  setNumerDomu(newValue);
                                  
                                  requestAnimationFrame(() => {
                                    input.setSelectionRange(start + 1, start + 1);
                                  });
                                }
                              }
                            }}
                            className="bg-gray-600 text-white p-3 rounded-lg text-xl font-semibold hover:bg-gray-500 active:bg-gray-400"
                          >
                            0
                          </button>
                          {/* Del button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                
                                if (input === telefonInputRef.current) {
                                  const currentCleanValue = orderData.telefon;
                                  const cleanCursorPos = input.value.substring(0, start).replace(/\s/g, '').length;
                                  const newCleanValue = currentCleanValue.substring(0, Math.max(0, cleanCursorPos - 1)) + currentCleanValue.substring(cleanCursorPos);
                                  
                                  setOrderData(prev => ({ ...prev, telefon: newCleanValue }));
                                  
                                  requestAnimationFrame(() => {
                                    const newCleanCursorPos = Math.max(0, cleanCursorPos - 1);
                                    const spacesBeforeCursor = Math.floor((newCleanCursorPos > 0 ? newCleanCursorPos - 1 : 0) / 3);
                                    const newFormattedCursorPos = newCleanCursorPos + spacesBeforeCursor;
                                    input.setSelectionRange(newFormattedCursorPos, newFormattedCursorPos);
                                  });
                                } else if (input === numerDomuInputRef.current) {
                                  const newValue = input.value.substring(0, Math.max(0, start - 1)) + input.value.substring(start);
                                  setNumerDomu(newValue);
                                  
                                  requestAnimationFrame(() => {
                                    input.setSelectionRange(Math.max(0, start - 1), Math.max(0, start - 1));
                                  });
                                }
                              }
                            }}
                            className="bg-red-600 text-white p-2 rounded-lg text-lg font-semibold hover:bg-red-500 active:bg-red-400"
                          >
                            DEL
                          </button>
                        </div>
                        
                        {/* Row 5: ABC button and Enter */}
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setKeyboardType('text');
                            }}
                            className="col-span-2 bg-gray-600 text-white p-2 rounded-lg text-sm font-semibold hover:bg-gray-500"
                          >
                            ABC
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowKeyboard(false);
                              setShowSuggestions(false);
                            }}
                            className="bg-teal-500 text-white p-2 rounded-lg text-xl font-bold hover:bg-teal-400"
                          >
                            ↵
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Text keyboard (QWERTY layout matching the image)
                      <div className="space-y-1">
                        {/* Row 1: Numbers */}
                        <div className="grid grid-cols-10 gap-1">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((key) => (
                            <button
                              type="button"
                              key={key}
                              onClick={(e) => {
                                e.preventDefault();
                                if (activeInputRef?.current) {
                                  const input = activeInputRef.current;
                                  const start = input.selectionStart || 0;
                                  const end = input.selectionEnd || 0;
                                  const newValue = input.value.substring(0, start) + key + input.value.substring(end);
                                  
                                  if (input === ulicaInputRef.current) {
                                    setUlica(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === numerDomuInputRef.current) {
                                    setNumerDomu(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === mieszkanieInputRef.current) {
                                    setNumerMieszkania(newValue);
                                  } else if (input === dodatkoweInfoInputRef.current) {
                                    setDodatkoweInfo(newValue);
                                  }
                                  
                                  requestAnimationFrame(() => {
                                    input.setSelectionRange(start + 1, start + 1);
                                  });
                                }
                              }}
                              className="bg-gray-600 text-white p-3 rounded-lg text-xl font-semibold hover:bg-gray-500 active:bg-gray-400"
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                        
                        {/* Polskie znaki - pojawia się gdy showPolishChars jest true */}
                        {showPolishChars && (
                          <div className="grid grid-cols-9 gap-1 bg-teal-900 p-2 rounded-lg">
                            {['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'].map((key) => (
                              <button
                                type="button"
                                key={key}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (activeInputRef?.current) {
                                    const input = activeInputRef.current;
                                    const start = input.selectionStart || 0;
                                    const end = input.selectionEnd || 0;
                                    const char = capsLock ? key : key.toLowerCase();
                                    const newValue = input.value.substring(0, start) + char + input.value.substring(end);
                                    
                                    // Najpierw ustaw wartość bezpośrednio w input
                                    input.value = newValue;
                                    
                                    // Ustaw pozycję kursora natychmiast
                                    const newPos = start + 1;
                                    input.setSelectionRange(newPos, newPos);
                                    input.focus();
                                    
                                    // Następnie zaktualizuj stan React
                                    if (input === ulicaInputRef.current) {
                                      setUlica(newValue);
                                      setMiejscowosc("");
                                      setUserManuallyChangedDzielnica(false);
                                    } else if (input === numerDomuInputRef.current) {
                                      setNumerDomu(newValue);
                                      setMiejscowosc("");
                                      setUserManuallyChangedDzielnica(false);
                                    } else if (input === mieszkanieInputRef.current) {
                                      setNumerMieszkania(newValue);
                                    } else if (input === dodatkoweInfoInputRef.current) {
                                      setDodatkoweInfo(newValue);
                                    }
                                  }
                                }}
                                className="bg-teal-700 text-white p-2 rounded-lg text-lg font-semibold hover:bg-teal-600 active:bg-teal-500"
                              >
                                {capsLock ? key : key.toLowerCase()}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Row 2: QWERTYUIOP */}
                        <div className="grid grid-cols-10 gap-1">
                          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => (
                            <button
                              type="button"
                              key={key}
                              onClick={(e) => {
                                e.preventDefault();
                                if (activeInputRef?.current) {
                                  const input = activeInputRef.current;
                                  const start = input.selectionStart || 0;
                                  const end = input.selectionEnd || 0;
                                  const char = capsLock ? key : key.toLowerCase();
                                  const newValue = input.value.substring(0, start) + char + input.value.substring(end);
                                  
                                  // Najpierw ustaw wartość bezpośrednio w input
                                  input.value = newValue;
                                  
                                  // Ustaw pozycję kursora natychmiast
                                  const newPos = start + 1;
                                  input.setSelectionRange(newPos, newPos);
                                  input.focus();
                                  
                                  // Następnie zaktualizuj stan React
                                  if (input === ulicaInputRef.current) {
                                    setUlica(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === numerDomuInputRef.current) {
                                    setNumerDomu(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === mieszkanieInputRef.current) {
                                    setNumerMieszkania(newValue);
                                  } else if (input === dodatkoweInfoInputRef.current) {
                                    setDodatkoweInfo(newValue);
                                  }
                                }
                              }}
                              className="bg-gray-600 text-white p-2 rounded-lg text-lg font-semibold hover:bg-gray-500 active:bg-gray-400"
                            >
                              {capsLock ? key : key.toLowerCase()}
                            </button>
                          ))}
                        </div>
                        
                        {/* Row 3: ASDFGHJKL */}
                        <div className="grid grid-cols-9 gap-1">
                          {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => (
                            <button
                              type="button"
                              key={key}
                              onClick={(e) => {
                                e.preventDefault();
                                if (activeInputRef?.current) {
                                  const input = activeInputRef.current;
                                  const start = input.selectionStart || 0;
                                  const end = input.selectionEnd || 0;
                                  const char = capsLock ? key : key.toLowerCase();
                                  const newValue = input.value.substring(0, start) + char + input.value.substring(end);
                                  
                                  // Najpierw ustaw wartość bezpośrednio w input
                                  input.value = newValue;
                                  
                                  // Ustaw pozycję kursora natychmiast
                                  const newPos = start + 1;
                                  input.setSelectionRange(newPos, newPos);
                                  input.focus();
                                  
                                  // Następnie zaktualizuj stan React
                                  if (input === ulicaInputRef.current) {
                                    setUlica(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === numerDomuInputRef.current) {
                                    setNumerDomu(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === mieszkanieInputRef.current) {
                                    setNumerMieszkania(newValue);
                                  } else if (input === dodatkoweInfoInputRef.current) {
                                    setDodatkoweInfo(newValue);
                                  }
                                }
                              }}
                              className="bg-gray-600 text-white p-3 rounded-lg text-xl font-semibold hover:bg-gray-500 active:bg-gray-400"
                            >
                              {capsLock ? key : key.toLowerCase()}
                            </button>
                          ))}
                        </div>
                        
                        {/* Row 4: Shift, ZXCVBNM, Backspace */}
                        <div className="grid grid-cols-10 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setCapsLock(!capsLock);
                            }}
                            className={`bg-gray-600 text-white p-2 rounded-lg text-lg hover:bg-gray-500 ${capsLock ? 'bg-teal-600' : ''}`}
                          >
                            
                          </button>
                          {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => (
                            <button
                              type="button"
                              key={key}
                              onClick={(e) => {
                                e.preventDefault();
                                if (activeInputRef?.current) {
                                  const input = activeInputRef.current;
                                  const start = input.selectionStart || 0;
                                  const end = input.selectionEnd || 0;
                                  const char = capsLock ? key : key.toLowerCase();
                                  const newValue = input.value.substring(0, start) + char + input.value.substring(end);
                                  
                                  // Najpierw ustaw wartość bezpośrednio w input
                                  input.value = newValue;
                                  
                                  // Ustaw pozycję kursora natychmiast
                                  const newPos = start + 1;
                                  input.setSelectionRange(newPos, newPos);
                                  input.focus();
                                  
                                  // Następnie zaktualizuj stan React
                                  if (input === ulicaInputRef.current) {
                                    setUlica(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === numerDomuInputRef.current) {
                                    setNumerDomu(newValue);
                                    setMiejscowosc("");
                                    setUserManuallyChangedDzielnica(false);
                                  } else if (input === mieszkanieInputRef.current) {
                                    setNumerMieszkania(newValue);
                                  } else if (input === dodatkoweInfoInputRef.current) {
                                    setDodatkoweInfo(newValue);
                                  }
                                }
                              }}
                              className="bg-gray-600 text-white p-2 rounded-lg text-lg font-semibold hover:bg-gray-500 active:bg-gray-400"
                            >
                              {capsLock ? key : key.toLowerCase()}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                const newValue = input.value.substring(0, Math.max(0, start - 1)) + input.value.substring(start);
                                
                                if (input === ulicaInputRef.current) {
                                  setUlica(newValue);
                                } else if (input === numerDomuInputRef.current) {
                                  setNumerDomu(newValue);
                                } else if (input === mieszkanieInputRef.current) {
                                  setNumerMieszkania(newValue);
                                } else if (input === dodatkoweInfoInputRef.current) {
                                  setDodatkoweInfo(newValue);
                                }
                                
                                requestAnimationFrame(() => {
                                  input.setSelectionRange(Math.max(0, start - 1), Math.max(0, start - 1));
                                });
                              }
                            }}
                            className="col-span-2 bg-gray-600 text-white p-2 rounded-lg text-lg hover:bg-gray-500"
                          >
                            
                          </button>
                        </div>
                        
                        {/* Row 5: 123, PL, comma, space, period, enter */}
                        <div className="grid grid-cols-12 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setKeyboardType('numeric');
                            }}
                            className="col-span-2 bg-gray-600 text-white p-2 rounded-lg text-sm font-semibold hover:bg-gray-500"
                          >
                            123
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowPolishChars(!showPolishChars);
                            }}
                            className={`bg-gray-600 text-white p-2 rounded-lg text-sm font-semibold hover:bg-gray-500 ${showPolishChars ? 'bg-teal-600' : ''}`}
                          >
                            PL
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                const newValue = input.value.substring(0, start) + '/' + input.value.substring(start);
                                
                                if (input === ulicaInputRef.current) {
                                  setUlica(newValue);
                                } else if (input === numerDomuInputRef.current) {
                                  setNumerDomu(newValue);
                                } else if (input === mieszkanieInputRef.current) {
                                  setNumerMieszkania(newValue);
                                } else if (input === dodatkoweInfoInputRef.current) {
                                  setDodatkoweInfo(newValue);
                                }
                                
                                requestAnimationFrame(() => {
                                  input.setSelectionRange(start + 1, start + 1);
                                });
                              }
                            }}
                            className="bg-gray-600 text-white p-2 rounded-lg text-lg hover:bg-gray-500"
                          >
                            /
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                const newValue = input.value.substring(0, start) + ' ' + input.value.substring(start);
                                
                                if (input === ulicaInputRef.current) {
                                  setUlica(newValue);
                                } else if (input === numerDomuInputRef.current) {
                                  setNumerDomu(newValue);
                                } else if (input === mieszkanieInputRef.current) {
                                  setNumerMieszkania(newValue);
                                } else if (input === dodatkoweInfoInputRef.current) {
                                  setDodatkoweInfo(newValue);
                                }
                                
                                requestAnimationFrame(() => {
                                  input.setSelectionRange(start + 1, start + 1);
                                });
                              }
                            }}
                            className="col-span-5 bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-500"
                          >
                            
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              if (activeInputRef?.current) {
                                const input = activeInputRef.current;
                                const start = input.selectionStart || 0;
                                const newValue = input.value.substring(0, start) + '.' + input.value.substring(start);
                                
                                if (input === ulicaInputRef.current) {
                                  setUlica(newValue);
                                } else if (input === numerDomuInputRef.current) {
                                  setNumerDomu(newValue);
                                } else if (input === mieszkanieInputRef.current) {
                                  setNumerMieszkania(newValue);
                                } else if (input === dodatkoweInfoInputRef.current) {
                                  setDodatkoweInfo(newValue);
                                }
                                
                                requestAnimationFrame(() => {
                                  input.setSelectionRange(start + 1, start + 1);
                                });
                              }
                            }}
                            className="bg-gray-600 text-white p-2 rounded-lg text-lg hover:bg-gray-500"
                          >
                            .
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowKeyboard(false);
                              setShowSuggestions(false);
                            }}
                            className="col-span-2 bg-teal-500 text-white p-2 rounded-lg text-xl font-bold hover:bg-teal-400"
                          >
                            ↵
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Wiersz 3: Info o dowozie i cenie dostawy */}
                {typZamowienia === "dowoz" && (
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-900">Dowóz: </span>
                        <span className="text-sm font-bold text-blue-700">
                          {dzielnicaNazwa || miejscowosc || "nie rozpoznano"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-700 uppercase">Cena dostawy:</label>
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
                          className="w-20 p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                        <span className="text-xs font-medium text-gray-700">PLN</span>
                      </div>
                    </div>
                    
                    {/* Ostrzeżenie gdy adres nie został rozpoznany */}
                    {addressNotRecognized && (
                      <div className="mt-1.5 p-1.5 bg-yellow-50 border border-yellow-300 rounded">
                        <p className="text-xs font-semibold text-yellow-800"> UWAGA! Adres nie został rozpoznany.</p>
                        <p className="text-xs text-yellow-700">Cena musi zostać wprowadzona ręcznie.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-700 mb-2 uppercase">Wybrane pizze</h3>
              {orderData.pizze.map((pizza, index) => (
                <div key={index} className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-lg border-2 border-orange-600 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white text-sm">{pizza.nazwa} - {pizza.rozmiar} ({pizza.cena} PLN)</span>
                    <div className="flex space-x-2 items-center">
                      <button
                        type="button"
                        onClick={() => toggleIngredients(index)}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/40 rounded-lg text-white text-xs font-bold uppercase tracking-wide transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        {expandedPizzaIndex === index ? "Ukryj składniki" : "Edytuj składniki"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePizza(index)}
                        className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 border-2 border-red-700 rounded-lg text-white font-bold text-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                        title="Usuń pizzę"
                      >
                        
                      </button>
                    </div>
                  </div>
                  
                  {/* Edytor składników */}
                  {expandedPizzaIndex === index && (
                    <div className="mt-2 border-t pt-2">
                      <h4 className="text-xs font-semibold mb-2">Modyfikuj składniki:</h4>
                      {skladnikiLoading && <div className="text-sm text-gray-500">Ładowanie składników...</div>}
                      {skladnikiError && <div className="text-sm text-red-500">Błąd: {skladnikiError.message}</div>}
                      {!skladnikiLoading && !skladnikiError && (!skladniki || skladniki.length === 0) && (
                        <div className="text-sm text-gray-500">Brak dostępnych składników.</div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {skladniki?.map((skladnik: any) => {
                          // Sprawdź czy składnik jest w bazie pierwszej pizzy
                          const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
                          const isBaseInFirst = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === skladnik.id);
                          
                          // Sprawdź czy składnik jest w bazie drugiej pizzy (dla pół na pół)
                          let isBaseInSecond = false;
                          if (pizza.polNaPol) {
                            const pizzaDef2 = pizzas?.find((p: any) => p.id === pizza.polNaPol?.id);
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
                              currentCount > 0 ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200'
                            }`}>
                              <span className="text-sm truncate mr-2" title={skladnik.nazwa}>
                                {skladnik.nazwa}
                              </span>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => updateIngredient(index, skladnik.id, -1)}
                                  disabled={currentCount <= 0}
                                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-300 disabled:opacity-50 ${
                                    currentCount > 0 ? 'bg-gray-500 text-white' : 'bg-gray-200'
                                  }`}
                                >
                                  -
                                </button>
                                <span className={`w-4 text-center text-sm font-medium ${currentCount > 0 ? 'text-white' : ''}`}>{currentCount}</span>
                                <button
                                  type="button"
                                  onClick={() => updateIngredient(index, skladnik.id, 1)}
                                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-300 ${
                                    currentCount > 0 ? 'bg-gray-500 text-white' : 'bg-gray-200'
                                  }`}
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
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 font-semibold text-sm transition-all"
                >
                  + Dodaj pizzę
                </button>
              )}
            </div>

            {/* Menu pizz */}
            {showAddPizza && (
              <div className="p-4 rounded-xl border-2 shadow-md bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <h3 className="text-base font-bold text-gray-900 mb-3 uppercase tracking-wide">
                  {showPolNaPolSelector 
                    ? "Wybierz drugą pizzę (pół na pół)"
                    : isPolNaPol 
                      ? "Wybierz pierwszą pizzę (pół na pół)"
                      : "Wybierz pizzę"
                  }
                </h3>
                
                {/* Wybór rozmiaru */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Rozmiar</label>
                  <div className="flex gap-3">
                    {isKupony ? (
                      <>
                        <label 
                          className={`flex-1 cursor-pointer transition-all ${
                            currentPizzaSize === "srednia" 
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg scale-105' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-md'
                          } border-2 rounded-lg px-4 py-3 text-center font-semibold text-sm`}
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
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg scale-105' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-md'
                          } border-2 rounded-lg px-4 py-3 text-center font-semibold text-sm`}
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
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg scale-105' 
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:shadow-md'
                          } border-2 rounded-lg px-4 py-3 text-center font-semibold text-sm`}
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
                  <div className="flex space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isPolNaPol}
                        onChange={(e) => setIsPolNaPol(e.target.checked)}
                        className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        Pół na pół (+4 PLN)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isKupony}
                        onChange={(e) => setIsKupony(e.target.checked)}
                        className="mr-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        KUPONY
                      </span>
                    </label>
                  </div>
                </div>

                {/* Siatka pizz */}
                {pizzasLoading && <div className="text-center py-3 text-gray-600 text-sm">Ładowanie pizz...</div>}
                {pizzasError && <div className="text-red-600 font-semibold text-center py-3 text-sm">Błąd: {pizzasError.message}</div>}
                {!pizzasLoading && !pizzasError && (!pizzas || pizzas.length === 0) && (
                  <div className="text-center py-3 text-gray-500 text-sm">Brak dostępnych pizz w bazie danych</div>
                )}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {(isKupony ? pizzas?.slice(0, 13) : pizzas?.slice(0, 40))
                    ?.map((pizza: any) => (
                      <button
                        key={pizza.id}
                        type="button"
                        onClick={() => handlePizzaSelect(pizza.id)}
                        className={`p-3 border-2 rounded-lg text-center hover:border-blue-500 hover:shadow-md transition-all ${
                          selectedPizzas.has(pizza.id) || firstPizzaId === pizza.id ? 'border-blue-500 bg-blue-50 shadow-md scale-105' : 'border-gray-300 bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold mb-1 text-gray-900">{pizza.nazwa}</div>
                        <div className="text-xs text-gray-600 font-semibold">
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
                  className="px-4 py-2 bg-gradient-to-br from-gray-600 to-gray-700 text-white font-semibold text-sm rounded-lg hover:from-gray-700 hover:to-gray-800 shadow-md hover:shadow-lg transition-all"
                >
                  Anuluj
                </button>
              </div>
            )}

            {/* Sosy */}
            <div className="bg-white p-2 rounded-lg border border-gray-300 shadow-sm">
              <h3 className="text-xs font-bold text-gray-700 mb-1.5 uppercase">Sosy (2 PLN/szt)</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-0.5">Sos pomidorowy</label>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pom: Math.max(0, prev.sosy.pom - 1) }
                      }))}
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-base font-bold text-gray-700 active:scale-95 transition-transform"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={orderData.sosy.pom}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pom: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-10 h-7 px-1 border border-gray-300 rounded text-center font-bold text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, pom: prev.sosy.pom + 1 }
                      }))}
                      className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded text-base font-bold text-white active:scale-95 transition-transform"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-0.5">Sos czosnkowy</label>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czos: Math.max(0, prev.sosy.czos - 1) }
                      }))}
                      className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-base font-bold text-gray-700 active:scale-95 transition-transform"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={orderData.sosy.czos}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czos: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-10 h-7 px-1 border border-gray-300 rounded text-center font-bold text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderData(prev => ({
                        ...prev,
                        sosy: { ...prev.sosy, czos: prev.sosy.czos + 1 }
                      }))}
                      className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded text-base font-bold text-white active:scale-95 transition-transform"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Pozycje extra i Napoje - obok siebie */}
            <div className="grid grid-cols-2 gap-3">
              {/* Pozycje extra */}
              <div className="bg-white p-2 rounded-lg border border-gray-300 shadow-sm">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">
                  Pozycje extra (opcjonalnie)
                </label>
                <div className="space-y-1.5">
                  {orderData.pozycjeExtraIds.map((extraId, index) => {
                    const wybranaExtra = pozycjeExtra?.find((e: any) => e.id === extraId);
                    return (
                      <div key={index} className="flex gap-1 items-center">
                        <select
                          value={extraId}
                          onChange={(e) => {
                            const newPozycjeExtraIds = [...orderData.pozycjeExtraIds];
                            newPozycjeExtraIds[index] = parseInt(e.target.value);
                            setOrderData(prev => ({ ...prev, pozycjeExtraIds: newPozycjeExtraIds }));
                          }}
                          className="flex-1 h-7 px-1.5 border border-gray-300 rounded text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-200 bg-white"
                        >
                          {pozycjeExtra?.map((extra: any) => (
                            <option key={extra.id} value={extra.id}>
                              {extra.nazwa} - {extra.cena} PLN
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newPozycjeExtraIds = orderData.pozycjeExtraIds.filter((_, i) => i !== index);
                            setOrderData(prev => ({ ...prev, pozycjeExtraIds: newPozycjeExtraIds }));
                          }}
                          className="px-2 h-7 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors active:scale-95"
                        >
                          Usuń
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      if (pozycjeExtra && pozycjeExtra.length > 0) {
                        // Znajdź "przekładaniec" jako domyślny
                        const przekladaniec = pozycjeExtra.find((e: any) => e.nazwa.toLowerCase().includes("przekladaniec") || e.nazwa.toLowerCase().includes("przekładaniec"));
                        const defaultExtraId = przekladaniec ? przekladaniec.id : pozycjeExtra[0].id;
                        setOrderData(prev => ({ 
                          ...prev, 
                          pozycjeExtraIds: [...prev.pozycjeExtraIds, defaultExtraId] 
                        }));
                      }
                    }}
                    className="w-full h-8 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-xs transition-colors active:scale-95"
                  >
                    + Dodaj pozycję extra
                  </button>
                </div>
              </div>

              {/* Napoje */}
              <div className="bg-white p-2 rounded-lg border border-gray-300 shadow-sm">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase">
                  Napoje (opcjonalnie)
                </label>
                <div className="space-y-1.5">
                  {orderData.napojeIds.map((napojId, index) => {
                    const wybranyNapoj = napoje?.find((n: any) => n.id === napojId);
                    return (
                      <div key={index} className="flex gap-1 items-center">
                        <select
                          value={napojId}
                          onChange={(e) => {
                            const newNapojeIds = [...orderData.napojeIds];
                            newNapojeIds[index] = parseInt(e.target.value);
                            setOrderData(prev => ({ ...prev, napojeIds: newNapojeIds }));
                          }}
                          className="flex-1 h-7 px-1.5 border border-gray-300 rounded text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-200 bg-white"
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
                          className="px-2 h-7 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors active:scale-95"
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
                    className="w-full h-8 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-xs transition-colors active:scale-95"
                  >
                    + Dodaj napój
                  </button>
                </div>
              </div>
            </div>

            {/* Płatność i Kierowca */}
            <div className="grid grid-cols-2 gap-3">
              {/* Płatność */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border-2 border-gray-200 shadow-md">
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Płatność</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="platnosc"
                      value="gotowka"
                      checked={orderData.platnosc === "gotowka"}
                      onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" }))}
                      className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-800">Gotówka</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="platnosc"
                      value="karta"
                      checked={orderData.platnosc === "karta"}
                      onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" }))}
                      className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-800">Karta</span>
                  </label>
                </div>
                {orderData.platnosc === "gotowka" && typZamowienia === "dowoz" && (
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    Płatność gotówką zostanie automatycznie dodana jako wpływ do sesji kierowcy
                  </p>
                )}
              </div>

              {/* Wybór kierowcy */}
              {!sesjeLoading && aktywneSesje && aktywneSesje.length > 0 && typZamowienia === "dowoz" && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border-2 border-blue-200 shadow-md">
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    {aktywneSesje.length === 1 ? "Kierowca:" : "Wybierz kierowcę:"}
                  </label>
                  {aktywneSesje.length === 1 ? (
                    <div className="text-lg font-bold text-blue-800 text-center p-3 bg-white rounded-lg">
                      {aktywneSesje[0].kierowca.nazwa}
                    </div>
                  ) : (
                    <select
                      value={wybranaSesjaId ?? ""}
                      onChange={(e) => setWybranaSesjaId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base bg-white"
                    >
                      <option value="">-- Wybierz kierowcę --</option>
                      {aktywneSesje.map((sesja: any) => (
                        <option key={sesja.id} value={sesja.id}>
                          {sesja.kierowca.nazwa}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Podsumowanie ceny */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border-2 border-gray-200 shadow-md">
              <div className="text-2xl font-extrabold text-center text-gray-900">
                Cena całkowita: {totalPrice.toFixed(2)} PLN
              </div>
            </div>

            {/* Przyciski akcji */}
            <div className="space-y-3 pt-3">
              <button
                type="submit"
                disabled={placeOrderMutation.isLoading || orderData.pizze.length === 0}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl text-base font-bold hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
              >
                {placeOrderMutation.isLoading ? "Składanie zamówienia..." : "Złóż zamówienie"}
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="w-full bg-gray-500 text-white py-3 px-6 rounded-xl hover:bg-gray-600 font-semibold text-sm transition-all"
              >
                Wyczyść formularz
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
