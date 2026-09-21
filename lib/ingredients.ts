/**
 * Lightweight ingredient classifier for shelf verdicts.
 * Matches normalized tokens against curated good / caution / concern lists.
 * Transparent and local — not a medical claim.
 */

export type IngredientTier = 'good' | 'caution' | 'bad' | 'neutral';

export type AnalyzedIngredient = {
  name: string;
  tier: IngredientTier;
  note: string;
};

export type IngredientAnalysis = {
  items: AnalyzedIngredient[];
  good: AnalyzedIngredient[];
  caution: AnalyzedIngredient[];
  bad: AnalyzedIngredient[];
  neutral: AnalyzedIngredient[];
  /** Rough quality signal from −4 (awful) to +3 (stellar). */
  signal: number;
  summary: string;
};

type Rule = {
  /** Substring match against normalized ingredient text. */
  match: string;
  tier: Exclude<IngredientTier, 'neutral'>;
  note: string;
  /** Extra weight when folding into the product score. */
  weight?: number;
};

const BAD_RULES: Rule[] = [
  { match: 'partially hydrogenated', tier: 'bad', note: 'Trans-fat source', weight: 2 },
  { match: 'hydrogenated oil', tier: 'bad', note: 'Hardened industrial fat', weight: 2 },
  { match: 'high fructose corn syrup', tier: 'bad', note: 'Ultra-processed sweetener', weight: 2 },
  { match: 'hfcs', tier: 'bad', note: 'Ultra-processed sweetener', weight: 2 },
  { match: 'corn syrup', tier: 'bad', note: 'Cheap liquid sugar', weight: 1 },
  { match: 'glucose-fructose', tier: 'bad', note: 'Industrial sweetener', weight: 1 },
  { match: 'aspartame', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'sucralose', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'saccharin', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'acesulfame', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'sodium nitrite', tier: 'bad', note: 'Cured-meat preservative', weight: 2 },
  { match: 'sodium nitrate', tier: 'bad', note: 'Cured-meat preservative', weight: 2 },
  { match: 'potassium bromate', tier: 'bad', note: 'Controversial dough improver', weight: 2 },
  { match: 'bha', tier: 'bad', note: 'Synthetic antioxidant', weight: 1 },
  { match: 'bht', tier: 'bad', note: 'Synthetic antioxidant', weight: 1 },
  { match: 'tbhq', tier: 'bad', note: 'Synthetic preservative', weight: 1 },
  { match: 'propyl gallate', tier: 'bad', note: 'Synthetic antioxidant', weight: 1 },
  { match: 'brominated vegetable', tier: 'bad', note: 'Controversial additive', weight: 2 },
  { match: 'artificial color', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'artificial colour', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'red 40', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'yellow 5', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'yellow 6', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'blue 1', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'allura red', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'tartrazine', tier: 'bad', note: 'Synthetic dye', weight: 1 },
  { match: 'caramel color', tier: 'bad', note: 'Industrial coloring', weight: 1 },
  { match: 'caramel colour', tier: 'bad', note: 'Industrial coloring', weight: 1 },
  { match: 'monosodium glutamate', tier: 'bad', note: 'Flavor enhancer', weight: 1 },
  { match: 'msg', tier: 'bad', note: 'Flavor enhancer', weight: 1 },
  { match: 'disodium inosinate', tier: 'bad', note: 'Flavor enhancer', weight: 1 },
  { match: 'disodium guanylate', tier: 'bad', note: 'Flavor enhancer', weight: 1 },
  { match: 'propylene glycol', tier: 'bad', note: 'Industrial humectant', weight: 1 },
  { match: 'polysorbate', tier: 'bad', note: 'Emulsifier', weight: 1 },
  { match: 'carrageenan', tier: 'bad', note: 'Controversial thickener', weight: 1 },
  { match: 'azodicarbonamide', tier: 'bad', note: 'Dough conditioner', weight: 2 },
  { match: 'interesterified', tier: 'bad', note: 'Re-engineered fat', weight: 1 },
  { match: 'palm oil', tier: 'caution', note: 'Often ultra-processed fat', weight: 1 },
  { match: 'palm fat', tier: 'caution', note: 'Often ultra-processed fat', weight: 1 },
  { match: 'vegetable oil', tier: 'caution', note: 'Refined commodity oil', weight: 0 },
  { match: 'vegetable fat', tier: 'caution', note: 'Refined commodity fat', weight: 0 },
  { match: 'maltodextrin', tier: 'caution', note: 'Processed filler starch', weight: 1 },
  { match: 'modified starch', tier: 'caution', note: 'Processed thickener', weight: 0 },
  { match: 'modified corn starch', tier: 'caution', note: 'Processed thickener', weight: 0 },
  { match: 'soy lecithin', tier: 'caution', note: 'Common emulsifier', weight: 0 },
  { match: 'soya lecithin', tier: 'caution', note: 'Common emulsifier', weight: 0 },
  { match: 'natural flavor', tier: 'caution', note: 'Opaque flavor blend', weight: 0 },
  { match: 'natural flavour', tier: 'caution', note: 'Opaque flavor blend', weight: 0 },
  { match: 'artificial flavor', tier: 'bad', note: 'Synthetic flavor', weight: 1 },
  { match: 'artificial flavour', tier: 'bad', note: 'Synthetic flavor', weight: 1 },
  { match: 'sodium benzoate', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'potassium sorbate', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'sodium sulfite', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'sodium sulphite', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'sulfur dioxide', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'sulphur dioxide', tier: 'caution', note: 'Preservative', weight: 0 },
  { match: 'invert sugar', tier: 'caution', note: 'Processed sweetener', weight: 0 },
  { match: 'dextrose', tier: 'caution', note: 'Refined sugar', weight: 0 },
  { match: 'fructose', tier: 'caution', note: 'Isolated sweetener', weight: 0 },
  { match: 'glucose syrup', tier: 'bad', note: 'Industrial sweetener syrup', weight: 1 },
  { match: 'glucose-fructose syrup', tier: 'bad', note: 'Industrial sweetener syrup', weight: 2 },
  { match: 'invert syrup', tier: 'caution', note: 'Processed sweetener', weight: 0 },
  { match: 'cane sugar', tier: 'caution', note: 'Added sugar', weight: 0 },
  { match: 'brown sugar', tier: 'caution', note: 'Added sugar', weight: 0 },
  { match: 'icing sugar', tier: 'caution', note: 'Added sugar', weight: 0 },
  { match: 'powdered sugar', tier: 'caution', note: 'Added sugar', weight: 0 },
  { match: 'sugar', tier: 'caution', note: 'Added sugar', weight: 0 },
  { match: 'neotame', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'advantame', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'cyclamate', tier: 'bad', note: 'Artificial sweetener', weight: 1 },
  { match: 'sorbitol', tier: 'caution', note: 'Sugar alcohol', weight: 0 },
  { match: 'maltitol', tier: 'caution', note: 'Sugar alcohol', weight: 0 },
  { match: 'xylitol', tier: 'caution', note: 'Sugar alcohol', weight: 0 },
  { match: 'erythritol', tier: 'caution', note: 'Sugar alcohol', weight: 0 },
  { match: 'titanium dioxide', tier: 'bad', note: 'Whitening agent (banned in EU foods)', weight: 2 },
  { match: 'e171', tier: 'bad', note: 'Titanium dioxide', weight: 2 },
  { match: 'potassium bromate', tier: 'bad', note: 'Controversial dough improver', weight: 2 },
  { match: 'bromated flour', tier: 'bad', note: 'Controversial flour treatment', weight: 2 },
  { match: 'sodium aluminum', tier: 'bad', note: 'Aluminum-containing additive', weight: 1 },
  { match: 'sodium aluminium', tier: 'bad', note: 'Aluminum-containing additive', weight: 1 },
  { match: 'ammonium sulfate', tier: 'caution', note: 'Dough conditioner', weight: 0 },
  { match: 'ammonium sulphate', tier: 'caution', note: 'Dough conditioner', weight: 0 },
  { match: 'calcium propionate', tier: 'caution', note: 'Mold inhibitor', weight: 0 },
  { match: 'sodium propionate', tier: 'caution', note: 'Mold inhibitor', weight: 0 },
  { match: 'butylated hydroxyanisole', tier: 'bad', note: 'Synthetic antioxidant (BHA)', weight: 1 },
  { match: 'butylated hydroxytoluene', tier: 'bad', note: 'Synthetic antioxidant (BHT)', weight: 1 },
  { match: 'tert-butylhydroquinone', tier: 'bad', note: 'Synthetic preservative (TBHQ)', weight: 1 },
  { match: 'dimethylpolysiloxane', tier: 'bad', note: 'Anti-foaming silicone', weight: 1 },
  { match: 'silicon dioxide', tier: 'caution', note: 'Anti-caking agent', weight: 0 },
  { match: 'cellulose gum', tier: 'caution', note: 'Processed thickener', weight: 0 },
  { match: 'xanthan gum', tier: 'caution', note: 'Processed thickener', weight: 0 },
  { match: 'guar gum', tier: 'caution', note: 'Thickener', weight: 0 },
  { match: 'gellan gum', tier: 'caution', note: 'Processed thickener', weight: 0 },
  { match: 'locust bean gum', tier: 'caution', note: 'Thickener', weight: 0 },
  { match: 'mono- and diglycerides', tier: 'caution', note: 'Emulsifier', weight: 0 },
  { match: 'mono and diglycerides', tier: 'caution', note: 'Emulsifier', weight: 0 },
  { match: 'datem', tier: 'caution', note: 'Emulsifier', weight: 0 },
  { match: 'ssl', tier: 'caution', note: 'Emulsifier', weight: 0 },
  { match: 'sodium stearoyl', tier: 'caution', note: 'Emulsifier', weight: 0 },
  { match: 'phosphoric acid', tier: 'caution', note: 'Acidulant', weight: 0 },
  { match: 'citric acid', tier: 'caution', note: 'Acidulant / preservative', weight: 0 },
  { match: 'malic acid', tier: 'caution', note: 'Acidulant', weight: 0 },
  { match: 'lactic acid', tier: 'caution', note: 'Acidulant', weight: 0 },
  { match: 'caffeine', tier: 'caution', note: 'Stimulant additive', weight: 0 },
  { match: 'taurine', tier: 'caution', note: 'Energy-drink additive', weight: 0 },
  { match: 'inositol', tier: 'caution', note: 'Energy-drink additive', weight: 0 },
  { match: 'carnitine', tier: 'caution', note: 'Supplement-style additive', weight: 0 },
  { match: 'yeast extract', tier: 'caution', note: 'Savory enhancer (glutamate-rich)', weight: 0 },
  { match: 'autolyzed yeast', tier: 'caution', note: 'Savory enhancer', weight: 0 },
  { match: 'hydrolyzed protein', tier: 'caution', note: 'Flavor / protein hydrolysate', weight: 0 },
  { match: 'hydrolyzed vegetable', tier: 'caution', note: 'Flavor hydrolysate', weight: 0 },
  { match: 'textured vegetable protein', tier: 'caution', note: 'Processed protein', weight: 0 },
  { match: 'mechanically separated', tier: 'bad', note: 'Mechanically separated meat', weight: 2 },
  { match: 'meat slurry', tier: 'bad', note: 'Low-grade meat input', weight: 2 },
  { match: 'pink slime', tier: 'bad', note: 'Lean finely textured beef', weight: 2 },
  { match: 'lean finely textured', tier: 'bad', note: 'Processed beef trim', weight: 2 },
  { match: 'corn oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'soybean oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'soya oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'rapeseed oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'canola oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'sunflower oil', tier: 'caution', note: 'Refined seed oil', weight: 0 },
  { match: 'cottonseed oil', tier: 'bad', note: 'Highly refined industrial oil', weight: 1 },
  { match: 'shortening', tier: 'bad', note: 'Industrial baking fat', weight: 1 },
  { match: 'margarine', tier: 'caution', note: 'Processed fat spread', weight: 1 },
  { match: 'lard', tier: 'caution', note: 'Rendered animal fat', weight: 0 },
  { match: 'tallow', tier: 'caution', note: 'Rendered animal fat', weight: 0 },
  { match: 'enriched flour', tier: 'caution', note: 'Refined flour with vitamins added back', weight: 0 },
  { match: 'bleached flour', tier: 'bad', note: 'Chemically treated flour', weight: 1 },
  { match: 'enriched wheat flour', tier: 'caution', note: 'Refined flour', weight: 0 },
  { match: 'white flour', tier: 'caution', note: 'Refined flour', weight: 0 },
  { match: 'refined flour', tier: 'caution', note: 'Refined flour', weight: 0 },
  { match: 'refined wheat', tier: 'caution', note: 'Refined flour', weight: 0 },
  { match: 'corn starch', tier: 'caution', note: 'Refined starch', weight: 0 },
  { match: 'cornflour', tier: 'caution', note: 'Refined starch', weight: 0 },
  { match: 'rice flour', tier: 'caution', note: 'Often refined', weight: 0 },
  { match: 'e102', tier: 'bad', note: 'Tartrazine dye', weight: 1 },
  { match: 'e110', tier: 'bad', note: 'Sunset yellow dye', weight: 1 },
  { match: 'e122', tier: 'bad', note: 'Carmoisine dye', weight: 1 },
  { match: 'e124', tier: 'bad', note: 'Ponceau dye', weight: 1 },
  { match: 'e129', tier: 'bad', note: 'Allura red dye', weight: 1 },
  { match: 'e133', tier: 'bad', note: 'Brilliant blue dye', weight: 1 },
  { match: 'e150', tier: 'caution', note: 'Caramel coloring', weight: 0 },
  { match: 'e211', tier: 'caution', note: 'Sodium benzoate', weight: 0 },
  { match: 'e221', tier: 'caution', note: 'Sodium sulfite', weight: 0 },
  { match: 'e250', tier: 'bad', note: 'Sodium nitrite', weight: 2 },
  { match: 'e251', tier: 'bad', note: 'Sodium nitrate', weight: 2 },
  { match: 'e320', tier: 'bad', note: 'BHA', weight: 1 },
  { match: 'e321', tier: 'bad', note: 'BHT', weight: 1 },
  { match: 'e621', tier: 'bad', note: 'MSG', weight: 1 },
  { match: 'e951', tier: 'bad', note: 'Aspartame', weight: 1 },
  { match: 'e955', tier: 'bad', note: 'Sucralose', weight: 1 },
];

const GOOD_RULES: Rule[] = [
  { match: 'extra virgin olive', tier: 'good', note: 'Quality fat', weight: 2 },
  { match: 'olive oil', tier: 'good', note: 'Quality fat', weight: 1 },
  { match: 'avocado oil', tier: 'good', note: 'Quality fat', weight: 1 },
  { match: 'coconut oil', tier: 'good', note: 'Whole-food fat', weight: 1 },
  { match: 'butter', tier: 'good', note: 'Simple dairy fat', weight: 1 },
  { match: 'ghee', tier: 'good', note: 'Clarified butter', weight: 1 },
  { match: 'whole milk', tier: 'good', note: 'Minimally processed dairy', weight: 1 },
  { match: 'organic', tier: 'good', note: 'Stricter farming standard', weight: 1 },
  { match: 'whole grain', tier: 'good', note: 'Intact grain', weight: 1 },
  { match: 'whole wheat', tier: 'good', note: 'Intact grain', weight: 1 },
  { match: 'wholemeal', tier: 'good', note: 'Intact grain', weight: 1 },
  { match: 'oats', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'rolled oats', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'steel cut', tier: 'good', note: 'Minimally processed oats', weight: 1 },
  { match: 'quinoa', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'brown rice', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'wild rice', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'buckwheat', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'barley', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'farro', tier: 'good', note: 'Whole grain', weight: 1 },
  { match: 'chickpea', tier: 'good', note: 'Whole legume', weight: 1 },
  { match: 'lentil', tier: 'good', note: 'Whole legume', weight: 1 },
  { match: 'black bean', tier: 'good', note: 'Whole legume', weight: 1 },
  { match: 'kidney bean', tier: 'good', note: 'Whole legume', weight: 1 },
  { match: 'pinto bean', tier: 'good', note: 'Whole legume', weight: 1 },
  { match: 'edamame', tier: 'good', note: 'Whole soy', weight: 1 },
  { match: 'tofu', tier: 'good', note: 'Simple soy protein', weight: 1 },
  { match: 'tempeh', tier: 'good', note: 'Fermented soy', weight: 1 },
  { match: 'almond', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'walnut', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'cashew', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'hazelnut', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'pistachio', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'pecan', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'macadamia', tier: 'good', note: 'Whole nut', weight: 1 },
  { match: 'chia', tier: 'good', note: 'Seed', weight: 1 },
  { match: 'flax', tier: 'good', note: 'Seed', weight: 1 },
  { match: 'hemp seed', tier: 'good', note: 'Seed', weight: 1 },
  { match: 'pumpkin seed', tier: 'good', note: 'Seed', weight: 1 },
  { match: 'sunflower seed', tier: 'good', note: 'Seed', weight: 1 },
  { match: 'sesame', tier: 'good', note: 'Seed', weight: 0 },
  { match: 'spinach', tier: 'good', note: 'Vegetable', weight: 1 },
  { match: 'kale', tier: 'good', note: 'Vegetable', weight: 1 },
  { match: 'broccoli', tier: 'good', note: 'Vegetable', weight: 1 },
  { match: 'cauliflower', tier: 'good', note: 'Vegetable', weight: 1 },
  { match: 'carrot', tier: 'good', note: 'Vegetable', weight: 0 },
  { match: 'beetroot', tier: 'good', note: 'Vegetable', weight: 0 },
  { match: 'sweet potato', tier: 'good', note: 'Vegetable', weight: 1 },
  { match: 'tomato', tier: 'good', note: 'Vegetable / fruit', weight: 0 },
  { match: 'apple', tier: 'good', note: 'Fruit', weight: 0 },
  { match: 'banana', tier: 'good', note: 'Fruit', weight: 0 },
  { match: 'blueberry', tier: 'good', note: 'Fruit', weight: 1 },
  { match: 'strawberry', tier: 'good', note: 'Fruit', weight: 0 },
  { match: 'raspberry', tier: 'good', note: 'Fruit', weight: 1 },
  { match: 'blackberry', tier: 'good', note: 'Fruit', weight: 1 },
  { match: 'date', tier: 'good', note: 'Whole-fruit sweetener', weight: 0 },
  { match: 'fig', tier: 'good', note: 'Fruit', weight: 0 },
  { match: 'cocoa', tier: 'good', note: 'Cocoa solids', weight: 0 },
  { match: 'cacao', tier: 'good', note: 'Cocoa solids', weight: 1 },
  { match: 'dark chocolate', tier: 'good', note: 'Cocoa-forward', weight: 1 },
  { match: 'honey', tier: 'good', note: 'Less-refined sweetener', weight: 0 },
  { match: 'maple syrup', tier: 'good', note: 'Less-refined sweetener', weight: 0 },
  { match: 'sea salt', tier: 'good', note: 'Simple seasoning', weight: 0 },
  { match: 'himalayan', tier: 'good', note: 'Simple seasoning', weight: 0 },
  { match: 'egg', tier: 'good', note: 'Whole-food protein', weight: 1 },
  { match: 'chicken', tier: 'good', note: 'Whole-food protein', weight: 1 },
  { match: 'turkey', tier: 'good', note: 'Whole-food protein', weight: 1 },
  { match: 'salmon', tier: 'good', note: 'Fatty fish', weight: 2 },
  { match: 'tuna', tier: 'good', note: 'Fish protein', weight: 1 },
  { match: 'sardine', tier: 'good', note: 'Fatty fish', weight: 2 },
  { match: 'anchovy', tier: 'good', note: 'Fish', weight: 1 },
  { match: 'beef', tier: 'good', note: 'Whole-food protein', weight: 1 },
  { match: 'lamb', tier: 'good', note: 'Whole-food protein', weight: 1 },
  { match: 'yogurt', tier: 'good', note: 'Cultured dairy', weight: 1 },
  { match: 'yoghurt', tier: 'good', note: 'Cultured dairy', weight: 1 },
  { match: 'greek yogurt', tier: 'good', note: 'Higher-protein dairy', weight: 1 },
  { match: 'kefir', tier: 'good', note: 'Fermented dairy', weight: 1 },
  { match: 'cottage cheese', tier: 'good', note: 'Simple dairy protein', weight: 1 },
  { match: 'ricotta', tier: 'good', note: 'Simple dairy', weight: 0 },
  { match: 'mozzarella', tier: 'good', note: 'Simple cheese', weight: 0 },
  { match: 'parmesan', tier: 'good', note: 'Aged cheese', weight: 0 },
  { match: 'cheddar', tier: 'good', note: 'Cheese', weight: 0 },
  { match: 'garlic', tier: 'good', note: 'Whole seasoning', weight: 0 },
  { match: 'onion', tier: 'good', note: 'Vegetable', weight: 0 },
  { match: 'ginger', tier: 'good', note: 'Whole seasoning', weight: 0 },
  { match: 'turmeric', tier: 'good', note: 'Spice', weight: 0 },
  { match: 'cinnamon', tier: 'good', note: 'Spice', weight: 0 },
  { match: 'black pepper', tier: 'good', note: 'Spice', weight: 0 },
  { match: 'basil', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'oregano', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'rosemary', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'thyme', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'parsley', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'cilantro', tier: 'good', note: 'Herb', weight: 0 },
  { match: 'coriander', tier: 'good', note: 'Herb / spice', weight: 0 },
  { match: 'lemon', tier: 'good', note: 'Citrus', weight: 0 },
  { match: 'lime', tier: 'good', note: 'Citrus', weight: 0 },
  { match: 'vinegar', tier: 'good', note: 'Simple acid', weight: 0 },
  { match: 'apple cider vinegar', tier: 'good', note: 'Simple acid', weight: 0 },
  { match: 'water', tier: 'good', note: 'Base ingredient', weight: 0 },
  { match: 'filtered water', tier: 'good', note: 'Base ingredient', weight: 0 },
  { match: 'sparkling water', tier: 'good', note: 'Base ingredient', weight: 0 },
];

/** Longer matches first so “extra virgin olive” wins over “olive oil”. */
const RULES: Rule[] = [...BAD_RULES, ...GOOD_RULES].sort(
  (a, b) => b.match.length - a.match.length
);

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_/\\|]+/g, ' ')
    .replace(/[^a-z0-9%.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Split ingredients_text into usable tokens. */
export function parseIngredientList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const stripped = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ');

  return stripped
    .split(/[,;•·\n]+|(?:\band\b)/i)
    .map((part) => part.replace(/^[\d.%\s-]+/, '').trim())
    .filter((part) => part.length >= 2 && part.length < 80)
    .slice(0, 40);
}

function classifyOne(raw: string): AnalyzedIngredient {
  const norm = normalize(raw);
  const hits = RULES.filter((rule) => norm.includes(rule.match));
  if (hits.length === 0) {
    return { name: displayName(raw), tier: 'neutral', note: 'Unclassified' };
  }

  const maxLen = Math.max(...hits.map((h) => h.match.length));
  // Prefer longest matches, but keep near-ties so "organic sugar" stays caution.
  const near = hits.filter((h) => h.match.length >= maxLen - 2);
  near.sort(
    (a, b) => tierRank(b.tier) - tierRank(a.tier) || b.match.length - a.match.length
  );
  const best = near[0]!;
  return { name: displayName(raw), tier: best.tier, note: best.note };
}

/** Prefer more severe flags on near-ties (bad > caution > good). */
function tierRank(tier: Exclude<IngredientTier, 'neutral'>): number {
  if (tier === 'bad') return 3;
  if (tier === 'caution') return 2;
  return 1;
}

function uniqueByName(items: AnalyzedIngredient[]): AnalyzedIngredient[] {
  const seen = new Set<string>();
  const out: AnalyzedIngredient[] = [];
  for (const item of items) {
    const key = normalize(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function analyzeIngredients(
  ingredientsText: string | null | undefined,
  additiveLabels: string[] = []
): IngredientAnalysis {
  const fromText = parseIngredientList(ingredientsText).map(classifyOne);
  const fromAdditives = additiveLabels.slice(0, 16).map((label) => {
    const hit = classifyOne(label);
    if (hit.tier !== 'neutral') return hit;
    return {
      name: displayName(label),
      tier: 'caution' as const,
      note: 'Listed additive',
    };
  });

  const items = uniqueByName([...fromText, ...fromAdditives]);
  const good = items.filter((i) => i.tier === 'good');
  const caution = items.filter((i) => i.tier === 'caution');
  const bad = items.filter((i) => i.tier === 'bad');
  const neutral = items.filter((i) => i.tier === 'neutral');

  let signal = 0;
  for (const item of [...good, ...caution, ...bad]) {
    const rule = RULES.find((r) => normalize(item.name).includes(r.match));
    const w = rule?.weight ?? (item.tier === 'bad' ? 1 : item.tier === 'good' ? 1 : 0);
    if (item.tier === 'bad') signal -= Math.max(1, w);
    else if (item.tier === 'good') signal += Math.max(0, w);
    else if (item.tier === 'caution') signal -= 0.35;
  }

  // Cap so a single wild label list can't dominate Nutri/NOVA entirely.
  signal = Math.max(-4, Math.min(3, Math.round(signal * 10) / 10));

  let summary = 'No ingredient details to grade.';
  if (items.length > 0) {
    if (bad.length === 0 && caution.length === 0 && good.length > 0) {
      summary = 'Ingredient list looks clean — mostly recognizable foods.';
    } else if (bad.length === 0 && caution.length > 0) {
      summary = 'No hard red flags, but a few processed fillers show up.';
    } else if (bad.length > 0 && good.length === 0) {
      summary = 'Several concern ingredients dominate this label.';
    } else if (bad.length > 0) {
      summary = 'Mix of solid foods and concern additives on the label.';
    } else {
      summary = 'Mostly unclassified ingredients — use Nutri-Score and NOVA as anchors.';
    }
  }

  return { items, good, caution, bad, neutral, signal, summary };
}
