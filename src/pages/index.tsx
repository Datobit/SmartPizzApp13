import Head from "next/head";
import { useState, useEffect } from "react";
import { api } from "~/utils/api";

interface PizzaSelection {
  id: number;
  nazwa: string;
  rozmiar: "mala" | "srednia" | "duza";
  cena: number;
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
  napojId?: number;
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
    napojId: undefined,
    pozycjeExtraIds: [],
    platnosc: "gotowka",
  });

  // Oddzielne pola adresu
  const [ulica, setUlica] = useState("");
  const [numerDomu, setNumerDomu] = useState("");
  const [dodatkoweInfo, setDodatkoweInfo] = useState("");

  const [selectedPizzas, setSelectedPizzas] = useState<Set<number>>(new Set());
  const [currentPizzaSize, setCurrentPizzaSize] = useState<"mala" | "srednia" | "duza">("mala");
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [showAddPizza, setShowAddPizza] = useState(false);
  const [isPolNaPol, setIsPolNaPol] = useState(false);
  const [isKupony, setIsKupony] = useState(false);
  const [showPolNaPolSelector, setShowPolNaPolSelector] = useState(false);
  const [firstPizzaId, setFirstPizzaId] = useState<number | null>(null);
  const [expandedPizzaIndex, setExpandedPizzaIndex] = useState<number | null>(null);

  // Queries
  const { data: pizzas, isLoading: pizzasLoading, error: pizzasError } = api.pizza.getAllPizzas.useQuery();
  const { data: napoje, isLoading: napojeLoading } = api.pizza.getAllNapoje.useQuery();
  const { data: pozycjeExtra, isLoading: extraLoading } = api.pizza.getAllPozycjeExtra.useQuery();
  const { data: skladniki, isLoading: skladnikiLoading, error: skladnikiError } = api.pizza.getAllSkladniki.useQuery();

  const searchStreets = api.pizza.searchUlice.useQuery(
    { query: ulica },
    { enabled: ulica.length > 2 }
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
  }, [pizzas, pizzasLoading, pizzasError, pozycjeExtra, extraLoading, skladniki, skladnikiError]);

  const calculatePriceMutation = api.pizza.calculatePrice.useMutation();
  const placeOrderMutation = api.pizza.placeOrder.useMutation();

  // Aktualizuj sugestie ulic
  useEffect(() => {
    console.log("Street search data:", searchStreets.data);
    if (searchStreets.data && searchStreets.data.length > 0) {
      setStreetSuggestions(searchStreets.data.map((street: any) => street.nazwa));
      setShowSuggestions(true);
    } else {
      setStreetSuggestions([]);
      if (ulica.length <= 2) {
        setShowSuggestions(false);
      }
    }
  }, [searchStreets.data, ulica]);

  // Aktualizuj pełny adres przy zmianie pól
  useEffect(() => {
    const parts = [ulica, numerDomu, dodatkoweInfo].filter(p => p.trim());
    const fullAddress = parts.join(", ");
    setOrderData(prev => ({ ...prev, adres: fullAddress }));
  }, [ulica, numerDomu, dodatkoweInfo]);

  // Kalkuluj cenę na żywo
  useEffect(() => {
    if (orderData.pizze.length > 0 || orderData.napojId || orderData.pozycjeExtraIds.length > 0 || orderData.sosy.pomidorowy > 0 || orderData.sosy.czosnkowy > 0) {
      calculatePriceMutation.mutate({
        pizze: orderData.pizze.map(p => ({ 
          id: p.id, 
          rozmiar: p.rozmiar,
          polNaPol: p.polNaPol
        })),
        sosy: orderData.sosy,
        napojId: orderData.napojId,
        pozycjeExtraIds: orderData.pozycjeExtraIds,
        isKupony: isKupony,
        typZamowienia: typZamowienia,
      }, {
        onSuccess: (data) => setTotalPrice(data.totalPrice),
      });
    } else {
      setTotalPrice(0);
    }
  }, [orderData, isKupony, typZamowienia]);

  const handlePizzaSelect = (pizzaId: number) => {
    const pizza = pizzas?.find((p: any) => p.id === pizzaId);
    if (!pizza) return;

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

    // Jeśli wybieramy drugą pizzę dla opcji "pół na pół"
    if (showPolNaPolSelector && firstPizzaId) {
      const firstPizza = pizzas?.find((p: any) => p.id === firstPizzaId);
      if (!firstPizza) return;

      const newPizza: PizzaSelection = {
        id: firstPizza.id,
        nazwa: `${firstPizza.nazwa} / ${pizza.nazwa} (pół na pół)`,
        rozmiar: currentPizzaSize,
        cena: Math.max(
          currentPizzaSize === "mala" ? firstPizza.cena_mala : 
          currentPizzaSize === "srednia" ? firstPizza.cena_srednia : 
          firstPizza.cena_duza,
          currentPizzaSize === "mala" ? pizza.cena_mala : 
          currentPizzaSize === "srednia" ? pizza.cena_srednia : 
          pizza.cena_duza
        ) + 4, // dopłata 4 PLN
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
      setCurrentPizzaSize("mala");
      setShowAddPizza(false);
      return;
    }

    // Jeśli to pierwsza pizza i wybrano opcję "pół na pół"
    if (isPolNaPol) {
      setFirstPizzaId(pizzaId);
      setShowPolNaPolSelector(true);
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

  const handleStreetSelect = (street: string) => {
    setUlica(street);
    setShowSuggestions(false);
  };

  const resetForm = () => {
    setOrderData({
      telefon: "",
      adres: "",
      pizze: [],
      sosy: { pomidorowy: 0, czosnkowy: 0 },
      napojId: undefined,
      pozycjeExtraIds: [],
      platnosc: "gotowka",
    });
    setUlica("");
    setNumerDomu("");
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
      
      const result = await placeOrderMutation.mutateAsync({
        telefon: orderData.telefon,
        adres: orderData.adres,
        pizze: orderData.pizze.map(p => ({ 
          id: p.id, 
          rozmiar: p.rozmiar,
          polNaPol: p.polNaPol
        })),
        sosy: orderData.sosy,
        napojId: orderData.napojId,
        pozycjeExtraIds: orderData.pozycjeExtraIds,
        platnosc: orderData.platnosc,
        isKupony: isKupony,
        typZamowienia: typZamowienia,
        skladniki: generateSkladnikiString(),
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
                  value={orderData.telefon}
                  onChange={(e) => setOrderData(prev => ({ ...prev, telefon: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="123456789"
                  required
                />
              </div>

              {/* Adres dostawy - 3 pola */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres dostawy
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Ulica z podpowiedziami */}
                  <div className="relative md:col-span-2">
                    <input
                      type="text"
                      value={ulica}
                      onChange={(e) => setUlica(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Nazwa ulicy..."
                      required
                    />
                    {showSuggestions && streetSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                        {streetSuggestions.map((street, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleStreetSelect(street)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          >
                            {street}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Numer domu/bloku */}
                  <div>
                    <input
                      type="text"
                      value={numerDomu}
                      onChange={(e) => setNumerDomu(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Nr domu"
                      required
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
                    placeholder="Dodatkowe informacje (np. nr mieszkania, piętro, kod domofonu)"
                  />
                </div>
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
                          // Sprawdź czy składnik jest w bazie pizzy
                          const pizzaDef = pizzas?.find(p => p.id === pizza.id);
                          const isBase = pizzaDef?.skladniki?.some((s: any) => s.id_skladnik === skladnik.id);
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
                  <div className="flex space-x-4">
                    {isKupony ? (
                      <>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="size"
                            value="srednia"
                            checked={currentPizzaSize === "srednia"}
                            onChange={() => setCurrentPizzaSize("srednia")}
                            className="mr-2"
                          />
                          Średnia (0 zł)
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="size"
                            value="duza"
                            checked={currentPizzaSize === "duza"}
                            onChange={() => setCurrentPizzaSize("duza")}
                            className="mr-2"
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
                        <label key={size.key} className="flex items-center">
                          <input
                            type="radio"
                            name="size"
                            value={size.key}
                            checked={currentPizzaSize === size.key}
                            onChange={(e) => setCurrentPizzaSize(e.target.value as "mala" | "srednia" | "duza")}
                            className="mr-2"
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
                        checked={isPolNaPol && !isKupony}
                        disabled={isKupony}
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
                          selectedPizzas.has(pizza.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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
                  <input
                    type="number"
                    min="0"
                    value={orderData.sosy.pomidorowy}
                    onChange={(e) => setOrderData(prev => ({
                      ...prev,
                      sosy: { ...prev.sosy, pomidorowy: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sos czosnkowy
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={orderData.sosy.czosnkowy}
                    onChange={(e) => setOrderData(prev => ({
                      ...prev,
                      sosy: { ...prev.sosy, czosnkowy: parseInt(e.target.value) || 0 }
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
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

            {/* Napój */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Napój (opcjonalnie)
              </label>
              <select
                value={orderData.napojId || ""}
                onChange={(e) => setOrderData(prev => ({
                  ...prev,
                  napojId: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                className="w-full p-3 border border-gray-300 rounded-md"
              >
                <option value="">-- Wybierz napój --</option>
                {napoje?.map((napoj: any) => (
                  <option key={napoj.id} value={napoj.id}>
                    {napoj.nazwa} - {napoj.cena} PLN
                  </option>
                ))}
              </select>
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

            {/* Podsumowanie ceny */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-xl font-bold text-center">
                Cena całkowita: {totalPrice.toFixed(2)} PLN
              </div>
              {totalPrice > 0 && totalPrice < 100 && (
                <div className="text-sm text-gray-600 text-center mt-2">
                  (zawiera 5 PLN za dostawę)
                </div>
              )}
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