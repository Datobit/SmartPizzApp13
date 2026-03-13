// Test parsowania modyfikacji

// Test 1: Zwykła pizza
console.log('=== TEST 1: Zwykła pizza ===');
const test1 = "MARGHARITA: +tuńczyk";
let modyfikacjeMap = {};

const line = test1.trim();
const mixedPolNaPolMatch = line.match(/^(.+?)\s*\/\s*(.+?)\s*\(p[oó]ł\s+na\s+p[oó]ł\):\s*(.+)$/i);
console.log('mixedPolNaPolMatch:', mixedPolNaPolMatch);

if (!mixedPolNaPolMatch) {
  const polNaPolFullMatch = line.match(/^(.+?):\s*\[(.+?):\s*(.+?)\](?:\s*\[(.+?):\s*(.+?)\])?$/i);
  console.log('polNaPolFullMatch:', polNaPolFullMatch);
  
  if (!polNaPolFullMatch) {
    const match = line.match(/^(.+?):\s*(.+)$/);
    console.log('standardMatch:', match);
    
    if (match) {
      const pizzaNazwa = match[1].trim().toUpperCase();
      const mods = match[2].trim();
      modyfikacjeMap[pizzaNazwa] = { isPolNaPol: false, mods: mods };
      console.log('Zapisano:', pizzaNazwa, '→', modyfikacjeMap[pizzaNazwa]);
    }
  }
}

console.log('\nmodyfikacjeMap:', JSON.stringify(modyfikacjeMap, null, 2));

// Test 2: Pizza pół na pół mixed format
console.log('\n=== TEST 2: Pizza pół na pół (mixed format) ===');
const test2 = "MARGHARITA / AL FUNGHI (pół na pół): [AL FUNGHI: -pieczarki]";
modyfikacjeMap = {};

const line2 = test2.trim();
const mixedMatch = line2.match(/^(.+?)\s*\/\s*(.+?)\s*\(p[oó]ł\s+na\s+p[oó]ł\):\s*(.+)$/i);
console.log('mixedPolNaPolMatch:', mixedMatch);

if (mixedMatch) {
  const pizza1Name = mixedMatch[1].trim();
  const pizza2Name = mixedMatch[2].trim();
  const modsString = mixedMatch[3].trim();
  const fullPizzaName = pizza1Name + ' / ' + pizza2Name;
  
  console.log('pizza1Name:', pizza1Name);
  console.log('pizza2Name:', pizza2Name);
  console.log('modsString:', modsString);
  
  const bracketsMatch = modsString.match(/\[(.+?):\s*(.+?)\](?:\s*\[(.+?):\s*(.+?)\])?/);
  console.log('bracketsMatch:', bracketsMatch);
  
  if (bracketsMatch) {
    const modPizzaName1 = bracketsMatch[1].trim();
    const mod1Text = bracketsMatch[2].trim();
    const modPizzaName2 = bracketsMatch[3] ? bracketsMatch[3].trim() : null;
    const mod2Text = bracketsMatch[4] ? bracketsMatch[4].trim() : null;
    
    console.log('modPizzaName1:', modPizzaName1);
    console.log('mod1Text:', mod1Text);
    console.log('modPizzaName2:', modPizzaName2);
    console.log('mod2Text:', mod2Text);
    
    const mods1 = modPizzaName1.toUpperCase() === pizza1Name.toUpperCase() ? mod1Text : (modPizzaName2 && modPizzaName2.toUpperCase() === pizza1Name.toUpperCase() ? mod2Text : '');
    const mods2 = modPizzaName1.toUpperCase() === pizza2Name.toUpperCase() ? mod1Text : (modPizzaName2 && modPizzaName2.toUpperCase() === pizza2Name.toUpperCase() ? mod2Text : '');
    
    console.log('mods1:', mods1);
    console.log('mods2:', mods2);
    
    modyfikacjeMap[fullPizzaName.toUpperCase()] = {
      isPolNaPol: true,
      left: mods1 ? { name: pizza1Name, mods: mods1 } : null,
      right: mods2 ? { name: pizza2Name, mods: mods2 } : null
    };
  }
}

console.log('\nmodyfikacjeMap:', JSON.stringify(modyfikacjeMap, null, 2));
console.log('\n=== Wyszukiwanie ===');
console.log('Szukam "AL FUNGHI"...');
const key = Object.keys(modyfikacjeMap)[0];
const entry = modyfikacjeMap[key];
if (entry && entry.isPolNaPol) {
  if (entry.left && entry.left.name.toUpperCase() === 'AL FUNGHI') {
    console.log('Znaleziono w left:', entry.left);
  }
  if (entry.right && entry.right.name.toUpperCase() === 'AL FUNGHI') {
    console.log('Znaleziono w right:', entry.right);
  }
}
