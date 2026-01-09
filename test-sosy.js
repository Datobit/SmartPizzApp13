// Test sprawdzający format sosów
const testSosy = {
  pom: 2,
  czos: 1
};

console.log("Format sosów do zapisu:", JSON.stringify(testSosy));
console.log("Typ pom:", typeof testSosy.pom);
console.log("Typ czos:", typeof testSosy.czos);

// Sprawdź czy wartości są większe od 0
if (testSosy.pom > 0 || testSosy.czos > 0) {
  console.log(" Sosy powinny być zapisane");
} else {
  console.log(" Brak sosów do zapisu");
}
