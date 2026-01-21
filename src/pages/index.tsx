import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Pizza, Phone, MapPin, CreditCard, Truck, ShoppingBag, Store } from "lucide-react";
import toast, { Toaster } from 'react-hot-toast';

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
  platnosc: "gotowka" | "karta" | "online";
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
  const [showPolishChars, setShowPolishChars] = useState(true);
  const [formModified, setFormModified] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [lastSelectedStreet, setLastSelectedStreet] = useState<string>("");
  const [isSelectingFromList, setIsSelectingFromList] = useState(false);
  
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
    { 
      enabled: ulica.length > 2,
      refetchOnMount: true,
      staleTime: 0, // Wyłącz cache całkowicie
      cacheTime: 0, // Wyłącz cache całkowicie
      keepPreviousData: true,
    }
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
    console.log("🔍 searchStreets status:", {
      enabled: ulica.length > 2,
      ulica,
      isLoading: searchStreets.isLoading,
      isFetching: searchStreets.isFetching,
      data: searchStreets.data,
      error: searchStreets.error,
      status: searchStreets.status,
      fetchStatus: searchStreets.fetchStatus,
    });
    
    // Dodatkowe debugowanie - czy tRPC w ogóle działa?
    if (pizzasLoading && !pizzas && !pizzasError) {
      console.error("⚠️ tRPC nie wykonuje zapytań! Sprawdź Network tab w DevTools");
    }
  }, [pizzas, pizzasLoading, pizzasError, pozycjeExtra, extraLoading, skladniki, skladnikiError, aktywneSesje, searchStreets, ulica]);

  const calculatePriceMutation = api.pizza.calculatePrice.useMutation();
  const placeOrderMutation = api.pizza.placeOrder.useMutation();

  // Funkcja do składania zamówienia i drukowania paragonu
  const handleSubmitAndPrint = async () => {
    // Walidacja - tylko dla dowozu sprawdzamy telefon i adres
    if (typZamowienia === "dowoz") {
      if (!orderData.telefon.trim()) {
        toast.error("Numer telefonu jest wymagany");
        return;
      }
      
      if (!ulica.trim()) {
        toast.error("Nazwa ulicy jest wymagana");
        return;
      }
      
      if (!numerDomu.trim()) {
        toast.error("Numer domu jest wymagany");
        return;
      }
      
      if (!wybranaSesjaId) {
        toast.error("Wybierz kierowcę dla dowozu!");
        return;
      }
    }
    
    if (orderData.pizze.length === 0) {
      toast.error("Dodaj przynajmniej jedną pizzę");
      return;
    }

    try {
      console.log("=== SKŁADANIE ZAMÓWIENIA Z DRUKOWANIEM ===");
      console.log("Składanie zamówienia z drukowaniem:", orderData);
      console.log("placeOrderMutation status:", {
        isLoading: placeOrderMutation.isLoading,
        isError: placeOrderMutation.isError,
        isSuccess: placeOrderMutation.isSuccess,
        error: placeOrderMutation.error,
      });
      
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
      
      console.log("=== WYWOŁANIE MUTACJI ===");
      const mutationInput = {
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
        isKupony: hasKupony || isKupony,
        typZamowienia: typZamowienia,
        skladniki: generateSkladnikiString(),
        customDeliveryPrice: customDeliveryPrice ?? undefined,
        sesjaId: (typZamowienia === "dowoz" && wybranaSesjaId) ? wybranaSesjaId : undefined,
        modyfikacjeSkladnikow: Object.keys(modyfikacjeSkladnikow).length > 0 ? modyfikacjeSkladnikow : undefined,
      };
      console.log("Mutation input:", mutationInput);
      
      const result = await placeOrderMutation.mutateAsync(mutationInput);
      console.log("=== WYNIK MUTACJI ===", result);
      
      if (result && result.success) {
        // Wywołaj endpoint drukowania
        try {
          const printResponse = await fetch('http://127.0.0.1:3006/api/print-latest', {
            method: 'POST',
          });
          
          if (printResponse.ok) {
            toast.success(`Zamówienie złożone i paragon wydrukowany! Cena: ${result.cenaCalkwita} PLN`);
          } else {
            toast.success(`Zamówienie złożone (Cena: ${result.cenaCalkwita} PLN), ale błąd drukowania paragonu`);
          }
        } catch (printError) {
          console.error("Błąd drukowania:", printError);
          toast.success(`Zamówienie złożone (Cena: ${result.cenaCalkwita} PLN), ale błąd drukowania paragonu`);
        }
        
        resetForm();
      } else {
        toast.error("Błąd podczas składania zamówienia");
      }
      
    } catch (error) {
      console.error("=== BŁĄD PODCZAS SKŁADANIA ZAMÓWIENIA ===");
      console.error("Szczegółowy błąd zamówienia:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error JSON:", JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        toast.error(`Błąd: ${error.message}`);
      } else {
        toast.error("Błąd podczas składania zamówienia. Spróbuj ponownie.");
      }
    }
  };

  // Automatycznie ustaw sesję jeśli jest tylko jedna aktywna
  useEffect(() => {
    if (aktywneSesje && aktywneSesje.length === 1) {
      setWybranaSesjaId(aktywneSesje[0].id);
    } else if (aktywneSesje && aktywneSesje.length === 0) {
      setWybranaSesjaId(null);
    }
  }, [aktywneSesje]);

  // Ostrzeżenie przed opuszczeniem strony jeśli formularz został zmodyfikowany
  useEffect(() => {
    // Sprawdź czy formularz został zmodyfikowany
    const isModified = 
      orderData.telefon.trim() !== "" ||
      ulica.trim() !== "" ||
      numerDomu.trim() !== "" ||
      orderData.pizze.length > 0 ||
      orderData.pozycjeExtraIds.length > 0 ||
      orderData.napojeIds.length > 0 ||
      orderData.sosy.pom > 0 ||
      orderData.sosy.czos > 0;
    
    setFormModified(isModified);
  }, [orderData, ulica, numerDomu]);

  // Aktualizuj sugestie ulic
  useEffect(() => {
    console.log("Street search data:", searchStreets.data);
    
    // Nie pokazuj sugestii jeśli użytkownik właśnie wybrał opcję z listy
    if (isSelectingFromList) {
      return;
    }
    
    if (searchStreets.data && searchStreets.data.length > 0) {
      // Przechowujemy obiekty z ulicą i dzielnicą
      setStreetSuggestions(searchStreets.data.filter((street: any) => street.ulica));
      
      // Pokaż sugestie tylko jeśli wartość nie jest równa ostatnio wybranej
      if (ulica !== lastSelectedStreet && ulica.length >= 3) {
        setShowSuggestions(true);
      }
      setSelectedSuggestionIndex(-1); // Resetuj wybrany indeks
    } else {
      setStreetSuggestions([]);
      if (ulica.length < 3) {
        setShowSuggestions(false);
      }
      setSelectedSuggestionIndex(-1);
    }
  }, [searchStreets.data, ulica, isSelectingFromList, lastSelectedStreet]);

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
    setIsSelectingFromList(true);
    setLastSelectedStreet(ulicaName);
    setUlica(ulicaName);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    setTimeout(() => {
      setIsSelectingFromList(false);
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
    setFormModified(false);
  };

  const handleNavigation = (url: string) => {
    if (formModified) {
      setPendingNavigation(url);
      setShowLeaveModal(true);
    } else {
      window.location.href = url;
    }
  };

  const handleStay = () => {
    setShowLeaveModal(false);
    setPendingNavigation(null);
  };

  const handleLeave = () => {
    setShowLeaveModal(false);
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
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

  // Oblicz koszt modyfikacji składników dla pizzy
  const calculateModificationCost = (pizza: PizzaSelection): number => {
    if (!pizza.modifications || Object.keys(pizza.modifications).length === 0) {
      return 0;
    }

    let totalCost = 0;
    Object.entries(pizza.modifications).forEach(([idStr, change]) => {
      const id = parseInt(idStr);
      const skladnik = skladniki?.find((s: any) => s.id === id);
      if (!skladnik) return;

      // Sprawdź czy składnik był w bazie tej pizzy
      const pizzaDef = pizzas?.find((p: any) => p.id === pizza.id);
      const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === id);

      if (change > 0) {
        // Dodanie składnika
        if (isBase) {
          // Dodatkowa porcja składnika bazowego - płatne
          totalCost += change * (skladnik.cena || 0);
        } else {
          // Nowy składnik - płatne
          totalCost += change * (skladnik.cena || 0);
        }
      }
      // Usunięcie składnika nie zmienia ceny (change < 0)
    });

    return totalCost;
  };

  // Pobierz listę modyfikacji z cenami
  const getModificationsList = (pizza: PizzaSelection): Array<{nazwa: string, cena: number | null}> => {
    console.log("=== getModificationsList ===");
    console.log("Pizza:", pizza.nazwa);
    console.log("Pizza modifications:", pizza.modifications);
    console.log("Skladniki loaded:", skladniki?.length || 0);
    
    if (!pizza.modifications || Object.keys(pizza.modifications).length === 0) {
      console.log("Brak modyfikacji");
      return [];
    }

    if (!skladniki || skladniki.length === 0) {
      console.log("Skladniki nie załadowane");
      return [];
    }

    const modifications: Array<{nazwa: string, cena: number | null}> = [];
    
    Object.entries(pizza.modifications).forEach(([idStr, change]) => {
      console.log(`Processing modification: ID=${idStr}, Change=${change}`);
      
      if (change === 0) {
        console.log("Change === 0, skipping");
        return;
      }
      
      const id = parseInt(idStr);
      const skladnik = skladniki.find((s: any) => s.id === id);
      
      console.log(`Looked for ID ${id}, found:`, skladnik);
      
      if (skladnik && skladnik.nazwa) {
        if (change > 0) {
          // Addition - show with price
          const cenaValue = skladnik.cena_srednia || 0;
          console.log(`Added: ${skladnik.nazwa}, cena: ${cenaValue}`);
          modifications.push({
            nazwa: skladnik.nazwa,
            cena: cenaValue
          });
        } else {
          // Removal - show with minus sign, no price
          console.log(`Removed: -${skladnik.nazwa}`);
          modifications.push({
            nazwa: `-${skladnik.nazwa}`,
            cena: null
          });
        }
      }
    });

    console.log("Final modifications:", modifications);
    return modifications;
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
        toast.error("Numer telefonu jest wymagany");
        return;
      }
      
      if (!ulica.trim()) {
        toast.error("Nazwa ulicy jest wymagana");
        return;
      }
      
      if (!numerDomu.trim()) {
        toast.error("Numer domu jest wymagany");
        return;
      }
      
      if (!wybranaSesjaId) {
        toast.error("Wybierz kierowcę dla dowozu!");
        return;
      }
    }
    
    if (orderData.pizze.length === 0) {
      toast.error("Dodaj przynajmniej jedną pizzę");
      return;
    }

    try {
      console.log("=== SKŁADANIE ZAMÓWIENIA (bez drukowania) ===");
      console.log("Składanie zamówienia:", orderData);
      console.log("Sosy przed wysłaniem:", orderData.sosy);
      console.log("placeOrderMutation status:", {
        isLoading: placeOrderMutation.isLoading,
        isError: placeOrderMutation.isError,
        isSuccess: placeOrderMutation.isSuccess,
        error: placeOrderMutation.error,
      });
      
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
      
      console.log("=== WYWOŁANIE MUTACJI (bez drukowania) ===");
      const mutationInput = {
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
      };
      console.log("Mutation input:", mutationInput);
      
      const result = await placeOrderMutation.mutateAsync(mutationInput);
      console.log("=== WYNIK MUTACJI ===", result);
      
      if (result && result.success) {
        toast.success(` Zamówienie złożone pomyślnie! Cena: ${result.cenaCalkwita} PLN`);
        resetForm();
      } else {
        toast.error(" Błąd podczas składania zamówienia");
      }
      
    } catch (error) {
      console.error("=== BŁĄD PODCZAS SKŁADANIA ZAMÓWIENIA (bez drukowania) ===");
      console.error("Szczegółowy błąd zamówienia:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error JSON:", JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        toast.error(` Błąd: ${error.message}`);
      } else {
        toast.error(" Błąd podczas składania zamówienia. Spróbuj ponownie.");
      }
    }
  };

  return (
    <>
      <Head>
        <title>PizzApp13 - Zamów Pizzę</title>
        <meta name="description" content="Aplikacja do zamawiania pizzy" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background py-3">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="PizzApp13 Logo" className="w-36 h-36 object-contain"/>
              <h1 className="text-5xl font-bold text-foreground tracking-tight">
                PizzApp13
              </h1>
            </div>
            <div className="flex gap-3">
              <Button
                variant="default"
                size="lg"
                className="shadow-lg font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation("http://localhost:3006");
                }}
              >
                Orders Viewer
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="shadow-lg font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation("http://localhost:3006/kuchnia");
                }}
              >
                🍳 Kuchnia
              </Button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Typ zamówienia */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center gap-3 font-bold">
                  <Store className="w-6 h-6" />
                  Typ zamówienia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    type="button"
                    variant={typZamowienia === "na_miejscu" ? "default" : "outline"}
                    onClick={() => setTypZamowienia("na_miejscu")}
                    className="h-20 text-lg font-semibold"
                  >
                    <Store className="w-6 h-6 mr-2" />
                    Na miejscu
                  </Button>
                  <Button
                    type="button"
                    variant={typZamowienia === "na_wynos" ? "default" : "outline"}
                    onClick={() => setTypZamowienia("na_wynos")}
                    className="h-20 text-lg font-semibold"
                  >
                    <ShoppingBag className="w-6 h-6 mr-2" />
                    Na wynos
                  </Button>
                  <Button
                    type="button"
                    variant={typZamowienia === "dowoz" ? "default" : "outline"}
                    onClick={() => setTypZamowienia("dowoz")}
                    className="h-20 text-lg font-semibold"
                  >
                    <Truck className="w-6 h-6 mr-2" />
                    Dowóz
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dane kontaktowe - tylko dla dowozu */}
            {typZamowienia === "dowoz" && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-3 font-bold">
                    <Phone className="w-6 h-6" />
                    Dane kontaktowe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Telefon */}
                  <div className="space-y-2">
                    <Label htmlFor="telefon" className="text-base font-semibold">Telefon</Label>
                    <Input
                      id="telefon"
                      ref={telefonInputRef}
                      type="tel"
                      className="h-12 text-base"
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
                      placeholder="123 456 789"
                      required
                    />
                  </div>

                  {/* Adres dostawy */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className="w-7 h-7 text-muted-foreground" />
                      <Label className="text-lg font-bold">Adres dostawy</Label>
                    </div>
                    
                    {/* Wiersz 1: Dzielnica | Dodatkowe informacje */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Dzielnica */}
                      <div className="space-y-2">
                        <Label htmlFor="dzielnica" className="text-sm font-semibold">Dzielnica</Label>
                        <select
                          id="dzielnica"
                          value={miejscowosc}
                          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onChange={(e) => {
                            const newMiejscowosc = e.target.value;
                            setMiejscowosc(newMiejscowosc);
                            setUserManuallyChangedDzielnica(true);
                            setAddressNotRecognized(true);
                            setCustomDeliveryPrice(null);
                          }}
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
                      <div className="space-y-2">
                        <Label htmlFor="dodatkowe" className="text-sm font-semibold">Dodatkowe informacje</Label>
                        <Input
                          id="dodatkowe"
                          ref={dodatkoweInfoInputRef}
                          type="text"
                          className="h-11 text-base"
                          value={dodatkoweInfo}
                          onChange={(e) => setDodatkoweInfo(e.target.value)}
                          onFocus={(e) => {
                            if (!showKeyboard || activeInputRef?.current !== dodatkoweInfoInputRef.current) {
                              setActiveInputRef(dodatkoweInfoInputRef);
                              setKeyboardType('text');
                              setShowKeyboard(true);
                            }
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
                          placeholder="Piętro, kod domofonu"
                        />
                      </div>
                    </div>

                    {/* Wiersz 2: Ulica / Nr / Mieszkanie */}
                    <div className="flex gap-2 mb-2">
                    {/* Ulica - 75% szerokości */}
                    <div className="relative flex-[3]">
                      <input
                        ref={ulicaInputRef}
                        type="text"
                        value={ulica}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setPreviousUlica(ulica);
                          setUlica(newValue);
                          setMiejscowosc("");
                          setUserManuallyChangedDzielnica(false);
                          
                          // Nie pokazuj sugestii gdy wartość jest ustawiana programowo (kliknięcie z listy)
                          if (isSelectingFromList) {
                            return;
                          }
                          
                          // Pokaż sugestie tylko gdy użytkownik zmienia wybraną wcześniej ulicę
                          if (newValue.length >= 3 && newValue !== lastSelectedStreet && streetSuggestions.length > 0) {
                            setShowSuggestions(true);
                          } else if (newValue !== lastSelectedStreet) {
                            setLastSelectedStreet("");
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
                          // NIE pokazuj sugestii przy fokusie - sugestie pokazują się tylko podczas wpisywania (onChange)
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
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all h-16"
                        placeholder="Ulica"
                        required
                      />
                      {showSuggestions && streetSuggestions.length > 0 && (
                        <div 
                          className="absolute z-[60] w-full bg-white border-2 border-gray-200 rounded-lg shadow-2xl bottom-full mb-1 max-h-72 overflow-y-auto"
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
                              className={`w-full text-left px-4 py-3 transition-all flex justify-between items-center ${
                                index === selectedSuggestionIndex
                                  ? 'bg-blue-50 border-2 border-blue-400'
                                  : 'hover:bg-gray-50 border-2 border-transparent'
                              }`}
                            >
                              <span className="font-semibold text-gray-900 text-base">{street.ulica}</span>
                              <span className="text-sm text-gray-600 ml-2">({street.dzielnica_nazwa})</span>
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
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all h-16"
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
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all h-16"
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
                        
                        {/* Row 5: Enter button */}
                        <div className="grid grid-cols-1 gap-1">
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
                            className={`bg-gray-600 text-white p-2 rounded-lg text-lg font-bold hover:bg-gray-500 ${capsLock ? 'bg-teal-600' : ''}`}
                          >
                            {capsLock ? '⇪' : '⇧'}
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
                            className="col-span-2 bg-red-600 text-white p-2 rounded-lg text-lg font-bold hover:bg-red-500"
                          >
                            ⌫
                          </button>
                        </div>
                        
                        {/* Row 5: PL, comma, space, period, enter */}
                        <div className="grid grid-cols-12 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowPolishChars(!showPolishChars);
                            }}
                            className={`col-span-2 bg-gray-600 text-white p-2 rounded-lg text-sm font-semibold hover:bg-gray-500 ${showPolishChars ? 'bg-teal-600' : ''}`}
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
                          <p className="text-xs font-semibold text-yellow-800">⚠ UWAGA! Adres nie został rozpoznany.</p>
                          <p className="text-xs text-yellow-700">Cena musi zostać wprowadzona ręcznie.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3 font-bold">
                  <Pizza className="w-6 h-6" />
                  Wybrane pizze
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  {orderData.pizze.length === 0 ? "Dodaj pizzę do zamówienia" : `${orderData.pizze.length} pizz w zamówieniu`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {orderData.pizze.map((pizza, index) => (
                  <Card key={index} className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-base mb-1">{pizza.nazwa}</h4>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="secondary">{pizza.rozmiar}</Badge>
                            <Badge variant="outline">{pizza.cena} PLN</Badge>
                            {pizza.isKupony && <Badge>KUPONY</Badge>}
                            {getModificationsList(pizza).map((mod, idx) => (
                              <Badge key={idx} variant="default" className={mod.cena === null ? "bg-red-500" : "bg-orange-500"}>
                                {mod.cena === null ? mod.nazwa : `${mod.nazwa} +${mod.cena.toFixed(2)} PLN`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="default"
                            className="font-semibold"
                            onClick={() => toggleIngredients(index)}
                          >
                            {expandedPizzaIndex === index ? "Ukryj" : "Edytuj składniki"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="default"
                            className="font-semibold"
                            onClick={() => removePizza(index)}
                          >
                            Usuń
                          </Button>
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
                    </CardContent>
                  </Card>
                ))}
                {!showAddPizza && orderData.pizze.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Brak wybranych pizz. Kliknij poniżej aby dodać.
                  </div>
                )}
                
                {!showAddPizza && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-16 border-dashed text-lg font-semibold"
                    onClick={() => setShowAddPizza(true)}
                  >
                    + Dodaj pizzę
                  </Button>
                )}
              </CardContent>
            </Card>

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
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-6">
                  <span className="text-base font-bold text-muted-foreground whitespace-nowrap">Sosy</span>
                  
                  {/* Sos pomidorowy */}
                  <div className="flex items-center gap-3 bg-secondary/30 rounded-lg px-4 py-2">
                    <span className="text-sm font-semibold whitespace-nowrap">Pomidorowy</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setOrderData(prev => ({
                          ...prev,
                          sosy: { ...prev.sosy, pom: Math.max(0, prev.sosy.pom - 1) }
                        }))}
                        className="w-12 h-12 text-2xl font-bold rounded-full"
                      >
                        −
                      </Button>
                      <div className="w-16 h-12 flex items-center justify-center bg-background rounded-md border-2">
                        <span className="text-2xl font-bold">{orderData.sosy.pom}</span>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => setOrderData(prev => ({
                          ...prev,
                          sosy: { ...prev.sosy, pom: prev.sosy.pom + 1 }
                        }))}
                        className="w-12 h-12 text-2xl font-bold rounded-full"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Sos czosnkowy */}
                  <div className="flex items-center gap-3 bg-secondary/30 rounded-lg px-4 py-2">
                    <span className="text-sm font-semibold whitespace-nowrap">Czosnkowy</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setOrderData(prev => ({
                          ...prev,
                          sosy: { ...prev.sosy, czos: Math.max(0, prev.sosy.czos - 1) }
                        }))}
                        className="w-12 h-12 text-2xl font-bold rounded-full"
                      >
                        −
                      </Button>
                      <div className="w-16 h-12 flex items-center justify-center bg-background rounded-md border-2">
                        <span className="text-2xl font-bold">{orderData.sosy.czos}</span>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => setOrderData(prev => ({
                          ...prev,
                          sosy: { ...prev.sosy, czos: prev.sosy.czos + 1 }
                        }))}
                        className="w-12 h-12 text-2xl font-bold rounded-full"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pozycje extra i Napoje - obok siebie */}
            <div className="grid grid-cols-2 gap-6">
              {/* Pozycje extra */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold">Pozycje extra</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {orderData.pozycjeExtraIds.map((extraId, index) => {
                    const wybranaExtra = pozycjeExtra?.find((e: any) => e.id === extraId);
                    return (
                      <div key={index} className="flex gap-2 items-center">
                        <select
                          value={extraId}
                          onChange={(e) => {
                            const newPozycjeExtraIds = [...orderData.pozycjeExtraIds];
                            newPozycjeExtraIds[index] = parseInt(e.target.value);
                            setOrderData(prev => ({ ...prev, pozycjeExtraIds: newPozycjeExtraIds }));
                          }}
                          className="flex-1 h-10 px-3 border border-input rounded-md text-sm font-medium bg-background focus:ring-2 focus:ring-ring"
                        >
                          {pozycjeExtra?.map((extra: any) => (
                            <option key={extra.id} value={extra.id}>
                              {extra.nazwa} - {extra.cena} PLN
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="destructive"
                          size="default"
                          onClick={() => {
                            const newPozycjeExtraIds = orderData.pozycjeExtraIds.filter((_, i) => i !== index);
                            setOrderData(prev => ({ ...prev, pozycjeExtraIds: newPozycjeExtraIds }));
                          }}
                          className="font-semibold"
                        >
                          Usuń
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => {
                      if (pozycjeExtra && pozycjeExtra.length > 0) {
                        const przekladaniec = pozycjeExtra.find((e: any) => e.nazwa.toLowerCase().includes("przekladaniec") || e.nazwa.toLowerCase().includes("przekładaniec"));
                        const defaultExtraId = przekladaniec ? przekladaniec.id : pozycjeExtra[0].id;
                        setOrderData(prev => ({ 
                          ...prev, 
                          pozycjeExtraIds: [...prev.pozycjeExtraIds, defaultExtraId] 
                        }));
                      }
                    }}
                    className="w-full h-12 font-semibold text-base"
                  >
                    + Dodaj pozycję extra
                  </Button>
                </CardContent>
              </Card>

              {/* Napoje */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold">Napoje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                          className="flex-1 h-10 px-3 border border-input rounded-md text-sm font-medium bg-background focus:ring-2 focus:ring-ring"
                        >
                          {napoje?.map((napoj: any) => (
                            <option key={napoj.id} value={napoj.id}>
                              {napoj.nazwa} - {napoj.cena} PLN
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="destructive"
                          size="default"
                          onClick={() => {
                            const newNapojeIds = orderData.napojeIds.filter((_, i) => i !== index);
                            setOrderData(prev => ({ ...prev, napojeIds: newNapojeIds }));
                          }}
                          className="font-semibold"
                        >
                          Usuń
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => {
                      if (napoje && napoje.length > 0) {
                        const napoj085 = napoje.find((n: any) => n.nazwa.includes("0,85") || n.nazwa.includes("0.85") || (n.nazwa.includes("napoje") && n.cena === 10));
                        const defaultNapojId = napoj085 ? napoj085.id : napoje[0].id;
                        setOrderData(prev => ({ 
                          ...prev, 
                          napojeIds: [...prev.napojeIds, defaultNapojId] 
                        }));
                      }
                    }}
                    className="w-full h-12 font-semibold text-base"
                  >
                    + Dodaj napój
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Płatność i Kierowca */}
            <div className="grid grid-cols-2 gap-6">
              {/* Płatność */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-3 font-bold">
                    <CreditCard className="w-6 h-6" />
                    Płatność
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer p-3 border-2 rounded-lg transition-all hover:bg-accent/50" 
                           style={{ borderColor: orderData.platnosc === "gotowka" ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                      <input
                        type="radio"
                        name="platnosc"
                        value="gotowka"
                        checked={orderData.platnosc === "gotowka"}
                        onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" | "online" }))}
                        className="w-5 h-5"
                      />
                      <span className="text-base font-semibold">Gotówka</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer p-3 border-2 rounded-lg transition-all hover:bg-accent/50"
                           style={{ borderColor: orderData.platnosc === "karta" ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                      <input
                        type="radio"
                        name="platnosc"
                        value="karta"
                        checked={orderData.platnosc === "karta"}
                        onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" | "online" }))}
                        className="w-5 h-5"
                      />
                      <span className="text-base font-semibold">Karta</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer p-3 border-2 rounded-lg transition-all hover:bg-accent/50"
                           style={{ borderColor: orderData.platnosc === "online" ? "hsl(var(--primary))" : "hsl(var(--border))" }}>
                      <input
                        type="radio"
                        name="platnosc"
                        value="online"
                        checked={orderData.platnosc === "online"}
                        onChange={(e) => setOrderData(prev => ({ ...prev, platnosc: e.target.value as "gotowka" | "karta" | "online" }))}
                        className="w-5 h-5"
                      />
                      <span className="text-base font-semibold">Online</span>
                    </label>
                  </div>
                  {orderData.platnosc === "gotowka" && typZamowienia === "dowoz" && (
                    <p className="text-sm text-muted-foreground mt-3 p-3 bg-muted/50 rounded-lg">
                      Płatność gotówką zostanie automatycznie dodana jako wpływ do sesji kierowcy
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Wybór kierowcy */}
              {!sesjeLoading && aktywneSesje && aktywneSesje.length > 0 && typZamowienia === "dowoz" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold">
                      {aktywneSesje.length === 1 ? "Kierowca:" : "Wybierz kierowcę:"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {aktywneSesje.length === 1 ? (
                      <div className="text-2xl font-bold text-primary text-center p-6 bg-primary/10 rounded-lg">
                        {aktywneSesje[0].kierowca.nazwa}
                      </div>
                    ) : (
                      <select
                        value={wybranaSesjaId ?? ""}
                        onChange={(e) => setWybranaSesjaId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full h-12 px-4 border-2 border-input rounded-lg focus:border-ring focus:ring-2 focus:ring-ring text-base font-medium bg-background"
                      >
                        <option value="">-- Wybierz kierowcę --</option>
                        {aktywneSesje.map((sesja: any) => (
                          <option key={sesja.id} value={sesja.id}>
                            {sesja.kierowca.nazwa}
                          </option>
                        ))}
                      </select>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Podsumowanie ceny */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-lg text-muted-foreground mb-3 font-semibold">Cena całkowita</p>
                  <p className="text-5xl font-bold text-primary">{totalPrice.toFixed(2)} PLN</p>
                </div>
              </CardContent>
            </Card>

            {/* Przyciski akcji */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={resetForm}
                className="w-48 h-16 text-lg font-semibold flex-shrink-0"
              >
                Wyczyść formularz
              </Button>
              
              <Button
                type="submit"
                disabled={placeOrderMutation.isLoading || orderData.pizze.length === 0}
                size="lg"
                className="flex-1 h-16 text-lg font-semibold"
              >
                {placeOrderMutation.isLoading ? "Składanie..." : "Złóż zamówienie"}
              </Button>

              <Button
                type="button"
                disabled={placeOrderMutation.isLoading || orderData.pizze.length === 0}
                size="lg"
                onClick={handleSubmitAndPrint}
                className="flex-1 h-16 text-lg font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              >
                {placeOrderMutation.isLoading ? "Składanie..." : "Złóż + Drukuj paragon"}
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Custom Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with blur */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleStay}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 z-10">
            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Czy na pewno chcesz opuścić formularz?
                </h2>
                <p className="text-lg text-gray-600">
                  Dane zostaną wyczyszczone
                </p>
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleStay}
                  className="px-8 py-4 bg-white text-black border-2 border-gray-300 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md"
                >
                  Zostań
                </button>
                <button
                  onClick={handleLeave}
                  className="px-8 py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-all shadow-md"
                >
                  Opuść
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster
        position="top-left"
        toastOptions={{
          duration: 5000,
          style: {
            background: 'white',
            color: '#1f2937',
            padding: '24px 32px',
            borderRadius: '16px',
            fontSize: '20px',
            fontWeight: '700',
            maxWidth: '700px',
            minHeight: '80px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
          },
          success: {
            iconTheme: {
              primary: 'hsl(25 95% 53%)',
              secondary: 'white',
            },
            style: {
              border: '3px solid hsl(25 95% 53%)',
              boxShadow: '0 20px 50px rgba(249, 115, 22, 0.4)',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
            style: {
              border: '3px solid #ef4444',
              boxShadow: '0 20px 50px rgba(239, 68, 68, 0.4)',
            },
          },
        }}
      />
    </>
  );
}
