const DATA_PATHS = {
  items: "data/items.json",
  phrases: "data/phrases.json",
  events: "data/events.json",
  npcs: "data/npcs.json",
  characterLayers: "data/character_layers.json"
};

const CREATION_OPTIONS = {
  genders: ["мужской", "женский"],
  jobs: ["безработный", "студент", "фрилансер"],
  traits: ["смелый", "осторожный", "общительный", "наблюдательный"],
  backgrounds: ["дом", "улица", "учеба", "работа"]
};

const CITY_MAP = {
  порт: ["набережная", "рыбный рынок", "кафе", "офис"],
  старый: ["улочки", "дом", "мастерская", "парикмахерская"],
  центр: ["площадь", "магазин одежды", "магазин белья", "магазин еды", "магазин техники"],
  академия: ["учебный корпус", "библиотека", "двор"],
  холмы: ["храм", "смотровая", "парк"]
};

class Randomizer {
  static roll(chance) {
    return Math.random() * 100 <= chance;
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
}

class Inventory {
  constructor(limit = 25) {
    this.limit = limit;
    this.items = [];
  }

  get totalWeight() {
    return this.items.reduce((sum, item) => sum + item.weight, 0);
  }

  canAdd(item) {
    return this.totalWeight + item.weight <= this.limit;
  }

  add(item) {
    if (this.canAdd(item)) {
      this.items.push(item);
      return true;
    }
    return false;
  }

  remove(itemId) {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index !== -1) {
      return this.items.splice(index, 1)[0];
    }
    return null;
  }
}

class Character {
  constructor(profile) {
    this.name = profile.name;
    this.gender = profile.gender;
    this.age = profile.age;
    this.job = profile.job;
    this.traits = profile.traits;
    this.background = profile.background;
    this.stats = profile.stats;
    this.skills = profile.skills;
    this.appearance = profile.appearance;
    this.health = profile.health;
    this.morale = profile.morale;
    this.energy = profile.energy;
    this.hunger = profile.hunger;
    this.leisure = profile.leisure;
    this.money = profile.money;
    this.attractiveness = profile.attractiveness;
    this.popularity = profile.popularity;
    this.sexuality = profile.sexuality;
    this.reputation = profile.reputation;
    this.relationships = profile.relationships;
    this.menstruation = profile.menstruation;
    if (profile.inventory instanceof Inventory) {
      this.inventory = profile.inventory;
    } else {
      this.inventory = new Inventory(profile.inventory?.limit || 25);
      this.inventory.items = profile.inventory?.items || [];
    }
    this.property = profile.property;
    this.equipment = profile.equipment || {
      верх: null,
      низ: null,
      обувь: null,
      белье: null,
      гаджет: null
    };
    this.photos = profile.photos || [];
    this.contacts = profile.contacts || [];
    this.layerSelections = profile.layerSelections || {};
    this.updateDerivedStats();
  }

  applyChange(change) {
    Object.entries(change.stats || {}).forEach(([key, value]) => {
      this.stats[key] = Randomizer.clamp(this.stats[key] + value, 1, 20);
    });
    Object.entries(change.skills || {}).forEach(([key, value]) => {
      this.skills[key] = Randomizer.clamp(this.skills[key] + value, 0, 10);
    });
    Object.entries(change.health || {}).forEach(([key, value]) => {
      this.health[key] = Randomizer.clamp(this.health[key] + value, 1, 100);
    });
    if (typeof change.energy === "number") {
      this.energy = Randomizer.clamp(this.energy + change.energy, 1, 100);
    }
    if (typeof change.morale === "number") {
      this.morale = Randomizer.clamp(this.morale + change.morale, -100, 100);
    }
    if (typeof change.money === "number") {
      this.money = Math.max(0, this.money + change.money);
    }
    if (typeof change.hunger === "number") {
      this.hunger = Randomizer.clamp(this.hunger + change.hunger, 0, 100);
    }
    if (typeof change.leisure === "number") {
      this.leisure = Randomizer.clamp(this.leisure + change.leisure, 0, 100);
    }
    if (typeof change.popularity === "number") {
      this.popularity = Randomizer.clamp(this.popularity + change.popularity, 0, 100);
    }
  }

  isNaked() {
    const clothingSlots = ["верх", "низ", "обувь", "белье"];
    return clothingSlots.every((slot) => !this.equipment[slot]);
  }

  applyItemEffects(item, direction = 1) {
    if (!item) return;
    if (item.effectStats) {
      const statsDelta = Object.entries(item.effectStats).reduce((acc, [key, value]) => {
        acc[key] = value * direction;
        return acc;
      }, {});
      this.applyChange({ stats: statsDelta });
    }
    if (item.effectMorale) {
      this.applyChange({ morale: item.effectMorale * direction });
    }
    if (item.effectSexuality) {
      this.sexuality = Randomizer.clamp(
        (this.sexuality || 0) + item.effectSexuality * direction,
        0,
        100
      );
    }
    this.updateDerivedStats();
  }

  equipItem(slot, item) {
    if (!item) return;
    const current = this.equipment[slot];
    if (current?.id === item.id) return;
    if (current) {
      this.applyItemEffects(current, -1);
    }
    this.equipment[slot] = item;
    this.applyItemEffects(item, 1);
  }

  unequipItem(slot) {
    const current = this.equipment[slot];
    if (!current) return;
    this.applyItemEffects(current, -1);
    this.equipment[slot] = null;
    this.updateDerivedStats();
  }

  updateDerivedStats() {
    const base =
      (this.appearance.face || 5) * 6 +
      (this.appearance.waist || 5) * 2 +
      (this.stats.charisma || 5) * 3;
    const clothingBonus = Object.values(this.equipment).reduce((sum, item) => {
      if (!item?.effectStats) return sum;
      return sum + (item.effectStats.charisma || 0) * 5;
    }, 0);
    this.attractiveness = Randomizer.clamp(base + clothingBonus, 0, 100);
    if (this.gender === "женский") {
      const nudityBoost = this.isNaked() ? 10 : 0;
      this.sexuality = Randomizer.clamp((this.attractiveness || 0) + nudityBoost, 0, 100);
    }
  }
}

class NPC {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.role = data.role;
    this.schedule = data.schedule;
    this.relationship = data.relationship || 0;
    this.district = data.district || Randomizer.pick(Object.keys(CITY_MAP));
    this.place = data.place || Randomizer.pick(CITY_MAP[this.district]);
  }
}

class World {
  constructor(config) {
    this.districts = config.districts;
    this.time = { day: 1, hour: 8 };
    this.activeDistrict = config.startDistrict;
    this.activePlace = config.startPlace;
  }

  advanceTime(hours = 1) {
    this.time.hour += hours;
    while (this.time.hour >= 24) {
      this.time.hour -= 24;
      this.time.day += 1;
    }
  }
}

class EventManager {
  constructor(events) {
    this.events = events;
  }

  pickEvents(context) {
    const possible = this.events.filter((event) => {
      if (!event.trigger) return true;
      if (event.trigger.district && event.trigger.district !== context.district) {
        return false;
      }
      if (event.trigger.hour && event.trigger.hour !== context.hour) {
        return false;
      }
      return true;
    });

    const amount = Randomizer.pick([1, 1, 2]);
    return possible.sort(() => 0.5 - Math.random()).slice(0, amount);
  }
}

class Parser {
  parse(input) {
    const clean = input.trim().toLowerCase();
    if (!clean) {
      return { intent: "idle" };
    }
    if (clean.includes("спорт") || clean.includes("трен")) {
      return { intent: "train" };
    }
    for (const [district, places] of Object.entries(CITY_MAP)) {
      if (clean.includes(district)) {
        return { intent: "go", target: { district, place: places[0] } };
      }
      const foundPlace = places.find((place) => clean.includes(place));
      if (foundPlace) {
        return { intent: "go", target: { district, place: foundPlace } };
      }
    }
    if (clean.includes("работ")) {
      return { intent: "work" };
    }
    if (clean.includes("общ")) {
      return { intent: "social" };
    }
    if (clean.includes("осмотр")) {
      return { intent: "look" };
    }
    if (clean.includes("телефон") || clean.includes("звон")) {
      return { intent: "phone" };
    }
    if (clean.includes("карта")) {
      return { intent: "map" };
    }
    if (clean.includes("бель") && clean.includes("магазин")) {
      return { intent: "lingerie" };
    }
    if (clean.includes("ед") || clean.includes("продукт")) {
      return { intent: "foodshop" };
    }
    if (clean.includes("кафе")) {
      return { intent: "cafe" };
    }
    if (clean.includes("техник") && clean.includes("магазин")) {
      return { intent: "techshop" };
    }
    if (clean.includes("магазин")) {
      return { intent: "shop" };
    }
    if (clean.includes("купить")) {
      return { intent: "buy", item: clean.replace("купить", "").trim() };
    }
    if (clean.includes("нпс") || clean.includes("люд")) {
      return { intent: "npc" };
    }
    if (clean.includes("поговор")) {
      return { intent: "talk" };
    }
    if (clean.includes("флирт")) {
      return { intent: "flirt" };
    }
    if (clean.includes("друж")) {
      return { intent: "befriend" };
    }
    if (clean.includes("взять заказ")) {
      return { intent: "pickup" };
    }
    if (clean.includes("достав")) {
      return { intent: "deliver" };
    }
    if (clean.includes("гардероб")) {
      return { intent: "wardrobe" };
    }
    if (clean.includes("надеть")) {
      return { intent: "wear", item: clean.replace("надеть", "").trim() };
    }
    if (clean.includes("снять")) {
      return { intent: "remove", item: clean.replace("снять", "").trim() };
    }
    if (clean.includes("готовить")) {
      return { intent: "cook" };
    }
    if (clean.includes("парикмахер")) {
      return { intent: "hair" };
    }
    if (clean.includes("есть") || clean.includes("поесть")) {
      return { intent: "eat" };
    }
    return { intent: "free", text: input };
  }
}

class Renderer {
  constructor(logElement) {
    this.logElement = logElement;
  }

  renderEntry({ narrative, dialogue, system, tables, options }) {
    const entry = document.createElement("div");
    entry.className = "entry";

    if (narrative) {
      const p = document.createElement("p");
      p.className = "narrative";
      p.textContent = narrative;
      entry.appendChild(p);
    }

    if (dialogue) {
      const p = document.createElement("p");
      p.className = "dialogue";
      p.textContent = dialogue;
      entry.appendChild(p);
    }

    if (system) {
      const p = document.createElement("p");
      p.className = "system";
      p.textContent = system;
      entry.appendChild(p);
    }

    if (tables) {
      tables.forEach((table) => {
        entry.appendChild(this.renderTable(table));
      });
    }

    if (options && options.length) {
      const list = document.createElement("ol");
      list.className = "options";
      options.forEach((option) => {
        const item = document.createElement("li");
        item.textContent = option;
        list.appendChild(item);
      });
      entry.appendChild(list);
    }

    this.logElement.appendChild(entry);
  }

  renderTable({ title, headers, rows }) {
    const wrapper = document.createElement("details");
    wrapper.className = "table-wrapper";
    wrapper.open = true;

    if (title) {
      const summary = document.createElement("summary");
      summary.textContent = title;
      wrapper.appendChild(summary);
    }

    const table = document.createElement("table");
    table.className = "markdown-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);
    return wrapper;
  }
}

class Game {
  constructor() {
    this.logElement = document.getElementById("log");
    this.mapElement = document.getElementById("map");
    this.availableActionsElement = document.getElementById("available-actions");
    this.actionButtonsElement = document.getElementById("action-buttons");
    this.playerTabsElement = document.getElementById("player-tabs");
    this.playerContentElement = document.getElementById("player-content");
    this.input = document.getElementById("player-input");
    this.sendAction = document.getElementById("send-action");
    this.newGame = document.getElementById("new-game");
    this.nextTurn = document.getElementById("next-turn");
    this.saveGame = document.getElementById("save-game");
    this.loadGame = document.getElementById("load-game");

    this.renderer = new Renderer(this.logElement);
    this.parser = new Parser();

    this.data = {
      items: [],
      phrases: {},
      events: [],
      npcs: [],
      characterLayers: {}
    };

    this.state = "idle";
    this.character = null;
    this.world = null;
    this.npcs = [];
    this.eventManager = null;
    this.pendingMenu = null;
    this.activeNpcIds = [];
    this.activeDelivery = null;
    this.characterLayers = null;
    this.layerSelections = {};

    this.creationQueue = [];
    this.currentQuestion = 0;
    this.profileDraft = {};
    this.activePlayerTab = "status";

    this.bindEvents();
    this.bootstrap();
  }

  bindEvents() {
    this.newGame.addEventListener("click", () => this.startCreation());
    this.nextTurn.addEventListener("click", () => this.runTurn());
    this.sendAction.addEventListener("click", () => this.handleInput());
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.handleInput();
      }
    });
    this.saveGame.addEventListener("click", () => this.save());
    this.loadGame.addEventListener("click", () => this.load());
    if (this.actionButtonsElement) {
      this.actionButtonsElement.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const value = button.dataset.action;
        if (!value) return;
        if (this.pendingMenu) {
          this.handleMenuSelection(value);
          return;
        }
        this.lastAction = value;
        this.runTurn(value);
      });
    }
    if (this.playerTabsElement) {
      this.playerTabsElement.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-tab]");
        if (!button) return;
        const tab = button.dataset.tab;
        if (!tab) return;
        this.activePlayerTab = tab;
        this.renderPlayerPanel();
      });
    }
  }

  async bootstrap() {
    await this.loadData();
    this.initializeCharacterLayers();
    this.renderer.renderEntry({
      narrative: "Прибрежный город встречает вас солью в воздухе, фонариками и мягким шумом прибоя.",
      system: "Нажмите «Создать персонажа», чтобы начать путешествие."
    });
  }

  async loadData() {
    const entries = await Promise.all(
      Object.entries(DATA_PATHS).map(async ([key, path]) => {
        try {
          const response = await fetch(path);
          if (!response.ok) throw new Error("Нет данных");
          const data = await response.json();
          return [key, data];
        } catch (error) {
          return [key, key === "phrases" || key === "characterLayers" ? {} : []];
        }
      })
    );
    entries.forEach(([key, data]) => {
      this.data[key] = data;
    });
  }

  startCreation() {
    this.reset();
    this.state = "creating";
    this.profileDraft = {
      stats: { strength: 5, agility: 5, flexibility: 5, charisma: 5, intellect: 5 },
      skills: { dance: 1, persuasion: 1, streetwise: 1, combat: 1 },
      appearance: { height: 170, weight: 65, waist: 5, face: 6, shoulders: 5, hips: 5, chest: 5, glutes: 5, phallus: 5 },
      health: { hp: 100 },
      energy: 80,
      morale: 10,
      hunger: 80,
      leisure: 50,
      money: 120,
      attractiveness: 50,
      popularity: 20,
      sexuality: 0,
      reputation: { police: 0, underworld: 0, syndicate: 0 },
      relationships: [],
      inventory: new Inventory(25),
      property: { address: "Старый квартал", size: "комната", furniture: [], devices: [] },
      menstruation: null,
      equipment: { верх: null, низ: null, обувь: null, белье: null, гаджет: null },
      photos: [],
      contacts: []
    };
    this.initializeCharacterLayers();
    this.profileDraft.layerSelections = this.serializeLayerSelections();
    this.creationQueue = [
      { key: "name", prompt: "Имя героя?" },
      { key: "gender", prompt: `Пол (варианты: ${CREATION_OPTIONS.genders.join(", ")})?` },
      { key: "age", prompt: "Возраст (18+)?" },
      { key: "job", prompt: `Стартовая занятость (варианты: ${CREATION_OPTIONS.jobs.join(", ")})?` },
      { key: "traits", prompt: `Выберите 1-2 черты (варианты: ${CREATION_OPTIONS.traits.join(", ")})?` },
      { key: "background", prompt: `Фон (варианты: ${CREATION_OPTIONS.backgrounds.join(", ")})?` },
      { key: "stats", prompt: "Распределите 50 очков статов (сила, ловкость, гибкость, харизма, интеллект). Формат: сила 10, ловкость 10, гибкость 10, харизма 10, интеллект 10." },
      { key: "confirm", prompt: "Подтвердить создание? (да/нет)" }
    ];
    this.currentQuestion = 0;
    this.enableInput(true);
    this.askNextQuestion();
  }

  askNextQuestion() {
    const question = this.creationQueue[this.currentQuestion];
    if (!question) return;
    this.reset();
    const prompt = this.getQuestionPrompt(question);
    if (question.key === "editor") {
      this.activePlayerTab = "editor";
      this.renderPlayerPanel();
    }
    this.renderer.renderEntry({
      dialogue: `Создание персонажа: ${prompt}`,
      system: "Введите ответ в поле ниже."
    });
  }

  handleInput() {
    const value = this.input.value.trim();
    if (!value) return;
    this.input.value = "";

    if (this.state === "creating") {
      this.handleCreationInput(value);
      return;
    }

    if (this.pendingMenu) {
      this.handleMenuSelection(value);
      return;
    }

    this.lastAction = value;
    this.runTurn(value);
  }

  handleCreationInput(value) {
    const question = this.creationQueue[this.currentQuestion];
    if (!question) return;

    switch (question.key) {
      case "name":
        this.profileDraft[question.key] = value;
        break;
      case "gender":
        if (!this.isValidChoice(value, CREATION_OPTIONS.genders)) {
          this.renderer.renderEntry({
            system: `Выберите пол из списка: ${CREATION_OPTIONS.genders.join(", ")}.`
          });
          return;
        }
        this.profileDraft.gender = value.toLowerCase();
        this.injectAppearanceQuestions();
        break;
      case "age":
        this.profileDraft.age = Number.parseInt(value, 10);
        if (Number.isNaN(this.profileDraft.age) || this.profileDraft.age < 18) {
          this.renderer.renderEntry({
            system: "Возраст должен быть 18+. Попробуйте снова."
          });
          return;
        }
        break;
      case "job":
        if (!this.isValidChoice(value, CREATION_OPTIONS.jobs)) {
          this.renderer.renderEntry({
            system: `Выберите занятость из списка: ${CREATION_OPTIONS.jobs.join(", ")}.`
          });
          return;
        }
        this.profileDraft.job = value.toLowerCase();
        break;
      case "traits":
        if (!this.applyTraits(value)) {
          this.renderer.renderEntry({
            system: `Выберите 1-2 черты из списка: ${CREATION_OPTIONS.traits.join(", ")}.`
          });
          return;
        }
        break;
      case "background":
        if (!this.isValidChoice(value, CREATION_OPTIONS.backgrounds)) {
          this.renderer.renderEntry({
            system: `Выберите фон из списка: ${CREATION_OPTIONS.backgrounds.join(", ")}.`
          });
          return;
        }
        this.profileDraft.background = value.toLowerCase();
        break;
      case "appearance":
        if (!this.applyAppearance(value)) {
          this.renderer.renderEntry({
            system: "Не удалось разобрать внешность. Проверьте формат."
          });
          return;
        }
        break;
      case "menstruation":
        this.profileDraft.menstruation = value.toLowerCase().startsWith("д") ? "да" : "нет";
        break;
      case "hair":
        if (!this.applyHair(value)) {
          this.renderer.renderEntry({
            system: "Введите прическу и цвет. Пример: стиль короткая, цвет темный."
          });
          return;
        }
        break;
      case "editor":
        if (!value.toLowerCase().startsWith("готов")) {
          this.renderer.renderEntry({
            system: "Настройте внешний вид в редакторе слева и напишите «готово»."
          });
          return;
        }
        this.profileDraft.layerSelections = this.serializeLayerSelections();
        break;
      case "stats":
        if (!this.applyStats(value)) {
          this.renderer.renderEntry({
            system: "Не удалось разобрать статы или сумма не равна 50. Попробуйте снова."
          });
          return;
        }
        break;
      case "confirm":
        if (value.toLowerCase().startsWith("д")) {
          this.finishCreation();
          return;
        }
        this.renderer.renderEntry({
          system: "Создание отменено. Нажмите «Создать персонажа», чтобы начать заново."
        });
        this.state = "idle";
        this.enableInput(false);
        return;
      default:
        break;
    }

    this.currentQuestion += 1;
    this.askNextQuestion();
  }

  isValidChoice(value, list) {
    return list.includes(value.trim().toLowerCase());
  }

  applyTraits(value) {
    const choices = value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const unique = Array.from(new Set(choices));
    if (unique.length === 0 || unique.length > 2) return false;
    if (!unique.every((trait) => CREATION_OPTIONS.traits.includes(trait))) return false;
    this.profileDraft.traits = unique;
    return true;
  }

  injectAppearanceQuestions() {
    const hasAppearance = this.creationQueue.some((question) => question.key === "appearance");
    if (hasAppearance) return;
    const insertIndex = this.creationQueue.findIndex((question) => question.key === "confirm");
    const appearanceQuestion = { key: "appearance", prompt: "" };
    const questions = [
      appearanceQuestion,
      { key: "editor", prompt: "Настройте внешний вид в редакторе слева и напишите «готово»." }
    ];
    if (this.profileDraft.gender === "женский") {
      questions.push({ key: "menstruation", prompt: "Месячные сейчас? (да/нет)" });
    }
    if (insertIndex === -1) {
      this.creationQueue.push(...questions);
    } else {
      this.creationQueue.splice(insertIndex, 0, ...questions);
    }
  }

  getQuestionPrompt(question) {
    if (question.key === "appearance") {
      if (this.profileDraft.gender === "мужской") {
        return "Внешность: рост, вес, плечи, талия, лицо (1-10), размер. Пример: рост 178, вес 78, плечи 6, талия 5, лицо 6, размер 6.";
      }
      return "Внешность: рост, вес, бедра, талия, грудь, ягодицы, лицо (1-10). Пример: рост 170, вес 65, бедра 6, талия 5, грудь 5, ягодицы 6, лицо 7.";
    }
    if (question.key === "menstruation") {
      return "Месячные сейчас? (да/нет)";
    }
    if (question.key === "editor") {
      return "Настройте внешний вид в редакторе слева и напишите «готово».";
    }
    return question.prompt;
  }

  applyStats(value) {
    const mapping = {
      сила: "strength",
      ловкость: "agility",
      гибкость: "flexibility",
      харизма: "charisma",
      интеллект: "intellect"
    };

    const entries = value.split(",").map((chunk) => chunk.trim());
    const stats = { ...this.profileDraft.stats };
    let total = 0;

    for (const entry of entries) {
      const [label, amountRaw] = entry.split(" ");
      if (!mapping[label]) return false;
      const amount = Number.parseInt(amountRaw, 10);
      if (Number.isNaN(amount)) return false;
      stats[mapping[label]] = amount;
      total += amount;
    }

    if (total !== 50) return false;
    this.profileDraft.stats = stats;
    return true;
  }

  applyAppearance(value) {
    const map =
      this.profileDraft.gender === "мужской"
        ? {
            рост: "height",
            вес: "weight",
            плечи: "shoulders",
            талия: "waist",
            лицо: "face",
            размер: "phallus"
          }
        : {
            рост: "height",
            вес: "weight",
            бедра: "hips",
            талия: "waist",
            грудь: "chest",
            ягодицы: "glutes",
            лицо: "face"
          };

    const entries = value.split(",").map((chunk) => chunk.trim());
    const appearance = { ...this.profileDraft.appearance };

    for (const entry of entries) {
      const [label, amountRaw] = entry.split(" ");
      if (!map[label]) return false;
      const amount = Number.parseInt(amountRaw, 10);
      if (Number.isNaN(amount)) return false;
      appearance[map[label]] = amount;
    }

    this.profileDraft.appearance = appearance;
    return true;
  }

  applyHair(value) {
    const parts = value.split(",").map((chunk) => chunk.trim().toLowerCase());
    const stylePart = parts.find((part) => part.startsWith("стиль"));
    const colorPart = parts.find((part) => part.startsWith("цвет"));
    if (!stylePart || !colorPart) return false;
    const style = stylePart.replace("стиль", "").trim();
    const color = colorPart.replace("цвет", "").trim();
    if (!style || !color) return false;
    this.profileDraft.appearance.hairStyle = style;
    this.profileDraft.appearance.hairColor = color;
    return true;
  }

  getStartLocation(background) {
    const normalized = background?.toLowerCase();
    if (normalized === "улица") {
      return { district: "порт", place: "набережная" };
    }
    if (normalized === "работа") {
      return { district: "порт", place: "офис" };
    }
    if (normalized === "учеба") {
      return { district: "центр", place: "площадь" };
    }
    return { district: "старый", place: "дом" };
  }

  finishCreation() {
    if (!this.profileDraft.layerSelections) {
      this.profileDraft.layerSelections = this.serializeLayerSelections();
    }
    this.character = new Character(this.profileDraft);
    this.layerSelections = this.applyLayerSelections(this.character.layerSelections);
    const starterItems = this.data.items.filter((item) => ["cash", "phone"].includes(item.id));
    starterItems.forEach((item) => this.character.inventory.add(item));
    this.equipStarterOutfit();
    this.character.updateDerivedStats();
    const startConfig = this.getStartLocation(this.profileDraft.background);
    this.world = new World({
      districts: Object.keys(CITY_MAP),
      startDistrict: startConfig.district,
      startPlace: startConfig.place
    });
    this.npcs = this.data.npcs.map((npc) => new NPC(npc));
    this.eventManager = new EventManager(this.data.events);
    this.spawnNpcs(10);

    this.state = "playing";
    this.pendingMenu = null;
    this.activePlayerTab = "status";
    this.enableInput(true);
    this.nextTurn.disabled = false;
    this.saveGame.disabled = false;

    this.reset();
    this.renderer.renderEntry({
      narrative: `Добро пожаловать в прибрежный город. ${this.character.name} начинает путь: ${this.world.activeDistrict}, ${this.world.activePlace}.`,
      system: "Введите действие или выберите кнопку."
    });
    this.renderStatus();
    this.renderMap();
    this.renderAvailableActions();
    this.moveNpcs();
    this.renderNpcList();
    this.renderActionButtons();
  }

  runTurn(forcedAction = "") {
    if (this.state !== "playing") return;

    const action = forcedAction || this.lastAction || "";
    const result = this.resolveAction(action);
    const events = this.eventManager.pickEvents({
      district: this.world.activeDistrict,
      hour: this.world.time.hour
    });

    this.world.advanceTime(1);
    this.applyPassiveEffects();

    this.reset();
    this.renderer.renderEntry({
      narrative: result.narrative,
      dialogue: result.dialogue,
      system: result.system,
      options: result.options
    });

    events.forEach((event) => {
      this.renderer.renderEntry({
        narrative: event.narrative,
        system: event.system,
        options: event.options
      });
      if (event.change) {
        this.character.applyChange(event.change);
      }
    });

    this.renderStatus();
    this.renderMap();
    this.renderAvailableActions();
    this.moveNpcs();
    this.renderNpcList();
    this.renderActionButtons();
  }

  resolveAction(input) {
    const parsed = this.parser.parse(input);
    const responses = this.data.phrases;
    const genderTag = this.character.gender === "женский" ? "Она" : "Он";
    this.pendingMenu = null;

    switch (parsed.intent) {
      case "train":
        this.character.applyChange(this.getTrainingOutcome());
        return {
          narrative: "Вы выбрали тренировку: мышцы горят, но прогресс заметен.",
          system: "Показатели обновлены тренировкой."
        };
      case "go":
        this.world.activeDistrict = parsed.target.district;
        this.world.activePlace = parsed.target.place;
        return {
          narrative: `Вы перемещаетесь: ${this.world.activeDistrict}, ${this.world.activePlace}.` 
        };
      case "work":
        return this.handleWorkAction();
      case "social":
        return this.handleSocialAction(responses, genderTag);
      case "phone":
        return this.handlePhoneAction();
      case "shop":
        return this.handleShopAction();
      case "lingerie":
        return this.handleLingerieShopAction();
      case "foodshop":
        return this.handleFoodShopAction();
      case "cafe":
        return this.handleCafeAction();
      case "techshop":
        return this.handleTechShopAction();
      case "buy":
        return this.handleBuyAction(parsed.item);
      case "npc":
        return this.handleNpcList();
      case "talk":
        return this.handleNpcInteraction("talk");
      case "flirt":
        return this.handleNpcInteraction("flirt");
      case "befriend":
        return this.handleNpcInteraction("befriend");
      case "pickup":
        return this.handlePickupAction();
      case "deliver":
        return this.handleDeliverAction();
      case "wardrobe":
        return this.handleWardrobeAction();
      case "wear":
        return this.handleWearAction(parsed.item);
      case "remove":
        return this.handleRemoveAction(parsed.item);
      case "cook":
        return this.handleCookAction();
      case "hair":
        return this.handleHairAction();
      case "eat":
        return this.handleEatAction();
      case "map":
        return {
          narrative: "Карта обновлена. Вы осматриваете доступные районы и точки.",
          system: "Смотрите панель «Карта» справа."
        };
      case "look":
        return {
          narrative: `Вы осматриваетесь: вокруг ${this.world.activeDistrict}, точка — ${this.world.activePlace}.`,
          system: "Подсказка: смотрите доступные действия в панели справа."
        };
      case "free":
        return {
          narrative: "Ваше действие добавлено в дневник. Мир отвечает лаконично, но запоминает всё.",
          system: `Введено: ${parsed.text}`
        };
      default:
        return {
          narrative: "Вы делаете паузу, оценивая варианты.",
          options: ["Тренироваться", "Пойти на набережную", "Проверить дом"]
        };
    }
  }

  applyPassiveEffects() {
    this.character.applyChange({ hunger: -4 });
    if (this.character.hunger <= 20) {
      this.character.applyChange({ health: { hp: -2 }, energy: -2, morale: -2 });
    }
    if (this.character.energy <= 20) {
      this.character.applyChange({ health: { hp: -2 }, morale: -2 });
    }
    if (this.character.isNaked()) {
      this.character.applyChange({ morale: -3 });
    }
    this.character.updateDerivedStats();
  }

  getStatCheck(statKey, baseChance = 50) {
    const stat = this.character.stats[statKey] || 5;
    const modifier = (stat - 10) * 3;
    return Randomizer.clamp(baseChance + modifier, 10, 90);
  }

  getTrainingOutcome() {
    const strengthBoost = this.character.stats.strength < 20 ? 1 : 0;
    return {
      stats: { strength: strengthBoost },
      health: { hp: -1 },
      energy: -6,
      morale: 3
    };
  }

  handleWorkAction() {
    if (this.character.job !== "курьер") {
      return {
        narrative: "Без работы вы не можете выполнить смену.",
        system: "Сначала устройтесь на работу через телефон."
      };
    }

    if (this.world.activePlace !== "офис") {
      return {
        narrative: "Для начала смены нужно отметиться в офисе логистики.",
        system: "Перейдите в «порт, офис»."
      };
    }

    if (this.activeDelivery) {
      return {
        narrative: "У вас уже есть активный заказ.",
        system: "Сначала доставьте или завершите текущий маршрут."
      };
    }

    const tasks = Randomizer.pick([2, 3, 4]);
    this.activeDelivery = {
      tasks,
      completed: 0,
      pickedUp: false,
      pickup: { district: "порт", place: "офис" },
      dropoff: this.getRandomDropoff()
    };

    return {
      narrative: "Вы получаете маршрут курьера с несколькими адресами.",
      system: `Заданий: ${tasks}. Заберите посылку и доставьте по адресу: ${this.activeDelivery.dropoff.district}, ${this.activeDelivery.dropoff.place}.`,
      options: ["Взять заказ", "Проверить карту"]
    };
  }

  handleSocialAction(responses, genderTag) {
    const genderBonus = this.character.gender === "женский" ? 5 : 0;
    const nudityPenalty = this.character.isNaked() ? -20 : 0;
    const chance = this.getStatCheck("charisma", 50 + genderBonus + nudityPenalty);
    const success = Randomizer.roll(chance);
    this.character.applyChange({ morale: success ? 3 : -1, energy: -2 });

    return {
      narrative: success
        ? `${genderTag} легко вступает в разговор, и люди открываются быстрее обычного.`
        : "Разговор идет сдержанно, придется поработать над подходом.",
      dialogue: Randomizer.pick(
        responses.smalltalk || ["Сосед: " + "Море сегодня спокойное, можно передохнуть."]
      ),
      system: this.character.isNaked() ? "Люди явно смущены вашим видом." : null
    };
  }

  getRandomDropoff() {
    const district = Randomizer.pick(Object.keys(CITY_MAP));
    const place = Randomizer.pick(CITY_MAP[district]);
    return { district, place };
  }

  handlePickupAction() {
    if (!this.activeDelivery) {
      return {
        narrative: "Сейчас нет активных заказов.",
        system: "Сначала начните смену в офисе."
      };
    }
    if (this.activeDelivery.pickedUp) {
      return {
        narrative: "Посылка уже у вас.",
        system: "Пора доставлять."
      };
    }

    if (
      this.world.activeDistrict !== this.activeDelivery.pickup.district ||
      this.world.activePlace !== this.activeDelivery.pickup.place
    ) {
      return {
        narrative: "Посылка находится в офисе логистики.",
        system: "Перейдите в «порт, офис»."
      };
    }

    this.character.applyChange({ energy: -3 });
    this.activeDelivery.pickedUp = true;
    return {
      narrative: "Вы забираете посылку и отправляетесь по маршруту.",
      system: `Адрес доставки: ${this.activeDelivery.dropoff.district}, ${this.activeDelivery.dropoff.place}.`,
      options: ["Доставить заказ"]
    };
  }

  handleDeliverAction() {
    if (!this.activeDelivery) {
      return {
        narrative: "Нет активных заказов для доставки.",
        system: "Сначала возьмите заказ."
      };
    }
    if (!this.activeDelivery.pickedUp) {
      return {
        narrative: "Сначала нужно забрать посылку в офисе.",
        system: "Перейдите в «порт, офис»."
      };
    }

    const { dropoff } = this.activeDelivery;
    if (this.world.activeDistrict !== dropoff.district || this.world.activePlace !== dropoff.place) {
      return {
        narrative: "Вы не в точке доставки.",
        system: `Нужно добраться до ${dropoff.district}, ${dropoff.place}.`
      };
    }

    const rollChance =
      this.getStatCheck("agility", 55) + this.getStatCheck("intellect", 45) / 4;
    const success = Randomizer.roll(rollChance);
    const payout = success ? 45 : 20;

    this.activeDelivery.completed += 1;
    this.character.applyChange({
      energy: -5,
      morale: success ? 2 : -1,
      money: payout
    });

    if (this.activeDelivery.completed >= this.activeDelivery.tasks) {
      this.activeDelivery = null;
      return {
        narrative: "Вы завершили все доставки смены.",
        system: `Оплата получена, смена закрыта.`
      };
    }

    this.activeDelivery.dropoff = this.getRandomDropoff();
    return {
      narrative: "Доставка завершена, приходит следующий адрес.",
      system: `Новый адрес: ${this.activeDelivery.dropoff.district}, ${this.activeDelivery.dropoff.place}.`,
      options: ["Доставить заказ"]
    };
  }

  handlePhoneAction() {
    if (!this.isPhoneAvailable()) {
      return {
        narrative: "Без телефона связь с миром ограничена.",
        system: "Наденьте гаджет через гардероб."
      };
    }

    this.pendingMenu = {
      type: "phone",
      options: this.getPhoneMenuOptions()
    };

    return {
      narrative: "Вы открываете меню телефона.",
      options: this.pendingMenu.options.map((option, index) => `${index + 1}. ${option}`)
    };
  }

  handlePhoneMenuSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return {
        narrative: "Нужно выбрать пункт меню по номеру.",
        system: "Например: 1"
      };
    }

    const option = this.pendingMenu.options[index];
    if (!option) {
      this.pendingMenu = null;
      return {
        narrative: "Такого пункта нет.",
        system: "Попробуйте другой номер."
      };
    }

    if (option === "Контакты") {
      return this.handlePhoneContactsMenu();
    }

    if (option === "Добавить контакт") {
      return this.handlePhoneAddContactMenu();
    }

    if (option === "Развлечься") {
      this.character.applyChange({ leisure: 8, morale: 2, energy: -2 });
      this.pendingMenu = null;
      return {
        narrative: "Вы проводите время в телефоне: музыка, видео и немного отвлечения.",
        system: "Досуг повышен."
      };
    }

    if (option === "Сделать фото") {
      this.pendingMenu = null;
      return this.handleTakePhoto();
    }

    if (option === "Устроиться курьером") {
      if (this.character.job === "курьер") {
        return {
          narrative: "Вы уже работаете курьером.",
          system: "Можно перейти к работе через офис."
        };
      }
      const chance = this.getStatCheck("intellect", 55);
      const success = Randomizer.roll(chance);
      if (success) {
        this.character.job = "курьер";
        this.pendingMenu = null;
        return {
          narrative: "Заявка принята. Контракт на курьерскую работу активирован.",
          system: "Новая работа: курьер."
        };
      }
      this.pendingMenu = null;
      return {
        narrative: "Ответ пока не пришел. Возможно, стоит улучшить навыки.",
        system: "Попробуйте снова позже."
      };
    }

    if (option === "Проверить статус") {
      this.pendingMenu = null;
      return {
        narrative: "Вы просматриваете сообщения.",
        system: `Статус: ${this.character.job}.`
      };
    }

    this.pendingMenu = null;
    return {
      narrative: "Телефон свернут.",
      system: "Меню закрыто."
    };
  }

  handlePhoneContactsMenu() {
    if (!this.character.contacts.length) {
      this.pendingMenu = null;
      return {
        narrative: "Контактов пока нет.",
        system: "Добавьте кого-то поблизости."
      };
    }
    const contacts = this.character.contacts
      .map((id) => this.npcs.find((npc) => npc.id === id))
      .filter(Boolean);
    this.pendingMenu = {
      type: "phone-contacts",
      contacts,
      options: contacts.map((npc) => npc.name)
    };
    return {
      narrative: "Кому позвонить?",
      options: contacts.map((npc, index) => `${index + 1}. ${npc.name}`)
    };
  }

  handlePhoneContactsSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return { narrative: "Выберите номер контакта." };
    }
    const npc = this.pendingMenu.contacts[index];
    if (!npc) {
      this.pendingMenu = null;
      return { narrative: "Такого контакта нет." };
    }
    npc.relationship = Randomizer.clamp(npc.relationship + 2, -100, 100);
    this.character.applyChange({ morale: 1 });
    this.pendingMenu = null;
    return {
      narrative: `Вы созваниваетесь с ${npc.name}.`,
      system: `Отношение улучшилось до ${npc.relationship}.`
    };
  }

  handlePhoneAddContactMenu() {
    const nearby = this.getNearbyNpcs().filter(
      (npc) => !this.character.contacts.includes(npc.id)
    );
    if (!nearby.length) {
      this.pendingMenu = null;
      return {
        narrative: "Рядом нет новых людей для добавления.",
        system: "Попробуйте в другой локации."
      };
    }
    this.pendingMenu = {
      type: "phone-add",
      options: nearby.map((npc) => npc.name),
      npcs: nearby
    };
    return {
      narrative: "Кого добавить в контакты?",
      options: nearby.map((npc, index) => `${index + 1}. ${npc.name}`)
    };
  }

  handlePhoneAddContactSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return { narrative: "Выберите номер." };
    }
    const npc = this.pendingMenu.npcs[index];
    if (!npc) {
      this.pendingMenu = null;
      return { narrative: "Такого номера нет." };
    }
    this.character.contacts.push(npc.id);
    this.pendingMenu = null;
    return {
      narrative: `${npc.name} добавлен(а) в контакты.`,
      system: "Можно позвонить позже."
    };
  }

  handleTakePhoto() {
    if (!this.isPhoneAvailable()) {
      return {
        narrative: "Телефон не у вас.",
        system: "Наденьте гаджет, чтобы сделать фото."
      };
    }
    const timeStamp = `День ${this.world.time.day}, ${this.world.time.hour}:00`;
    const outfit = Object.values(this.character.equipment)
      .filter((item) => item?.name)
      .map((item) => item.name)
      .join(", ") || "без одежды";
    const base = this.character.attractiveness || 50;
    const cameraBonus = this.character.property.devices?.some((device) => device.toLowerCase().includes("камера"))
      ? 5
      : 0;
    const rating = Randomizer.clamp(
      base + (this.character.stats.charisma || 5) * 2 + (this.character.isNaked() ? -5 : 5) + cameraBonus,
      0,
      100
    );
    this.character.photos.push({
      description: `Фото у ${this.world.activeDistrict}, ${this.world.activePlace}.`,
      outfit,
      time: timeStamp,
      rating
    });
    this.character.applyChange({ popularity: Math.round(rating / 10) });
    return {
      narrative: "Вы делаете снимок на память.",
      system: `Оценка фото: ${rating}. Популярность выросла.`
    };
  }

  handleShopAction() {
    if (this.world.activePlace !== "магазин одежды") {
      return {
        narrative: "Здесь нет витрин одежды.",
        system: "Переместитесь в «магазин одежды»."
      };
    }

    const stock = this.getShopStock("clothing");
    if (stock.length === 0) {
      return { narrative: "Полки пусты. Похоже, нужно завезти новые модели." };
    }

    const categories = this.getShopCategories(stock);
    this.pendingMenu = {
      type: "shop",
      stock,
      categories,
      options: categories
    };

    return {
      narrative: "Вы открываете каталог магазина.",
      options: categories.map((category, index) => `${index + 1}. ${category}`)
    };
  }

  handleTechShopAction() {
    if (this.world.activePlace !== "магазин техники") {
      return {
        narrative: "Магазин техники находится в центре.",
        system: "Переместитесь в «центр, магазин техники»."
      };
    }
    const stock = this.getShopStock("tech");
    if (stock.length === 0) {
      return { narrative: "Витрины пусты. Ожидается поставка." };
    }
    this.pendingMenu = {
      type: "tech",
      stock,
      view: "category",
      filtered: stock,
      options: stock.map((item) => item.name)
    };
    return {
      narrative: "Каталог техники.",
      options: stock.map((item, index) => `${index + 1}. ${item.name} (${item.price} кр.)`)
    };
  }

  handleLingerieShopAction() {
    if (this.world.activePlace !== "магазин белья") {
      return {
        narrative: "Это не магазин белья.",
        system: "Переместитесь в «центр, магазин белья»."
      };
    }

    const stock = this.getShopStock("lingerie");
    if (stock.length === 0) {
      return { narrative: "Полки пусты. Похоже, нужно завезти новые модели." };
    }

    const categories = this.getShopCategories(stock);
    this.pendingMenu = {
      type: "lingerie",
      stock,
      categories,
      options: categories
    };

    return {
      narrative: "Вы открываете каталог белья.",
      options: categories.map((category, index) => `${index + 1}. ${category}`)
    };
  }

  handleFoodShopAction() {
    if (this.world.activePlace !== "магазин еды") {
      return {
        narrative: "Здесь нет продуктовых полок.",
        system: "Переместитесь в «центр, магазин еды»."
      };
    }

    const stock = this.getShopStock("food");
    if (stock.length === 0) {
      return { narrative: "Полки пусты. Похоже, доставка задержалась." };
    }

    const categories = this.getShopCategories(stock);
    this.pendingMenu = {
      type: "foodshop",
      stock,
      categories,
      options: categories
    };

    return {
      narrative: "Вы открываете витрину продуктового магазина.",
      options: categories.map((category, index) => `${index + 1}. ${category}`)
    };
  }

  handleCafeAction() {
    if (this.world.activePlace !== "кафе") {
      return {
        narrative: "Кафе здесь нет.",
        system: "Переместитесь в «порт, кафе»."
      };
    }

    const stock = this.getShopStock("cafe");
    const pricedStock = stock.map((item) => ({ ...item, price: item.price || 50 }));
    if (stock.length === 0) {
      return { narrative: "Сегодняшнее меню уже разобрали." };
    }

    this.pendingMenu = {
      type: "cafe",
      stock: pricedStock,
      view: "category",
      filtered: pricedStock,
      options: pricedStock.map((item) => item.name)
    };

    return {
      narrative: "Меню кафе на сегодня.",
      options: pricedStock.map((item, index) => `${index + 1}. ${item.name} (${item.price} кр.)`)
    };
  }

  handleShopMenuSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return {
        narrative: "Выберите номер товара.",
        system: "Например: 1"
      };
    }
    if (this.pendingMenu.view === "category") {
      const item = this.pendingMenu.filtered[index];
      if (!item) {
        this.pendingMenu = null;
        return {
          narrative: "Такого номера нет.",
          system: "Попробуйте другой."
        };
      }
      if (this.pendingMenu.type === "cafe") {
        const price = item.price || 50;
        if (this.character.money < price) {
          this.pendingMenu = null;
          return {
            narrative: "Недостаточно средств.",
            system: `Нужно ${price} кредитов.`
          };
        }
        this.character.applyChange({ hunger: item.nutrition || 15, morale: 2, money: -price });
        this.pendingMenu = null;
        return {
          narrative: `Вы заказываете «${item.name}».`,
          system: "Блюдо сразу съедено, голод восстановлен."
        };
      }
      this.pendingMenu = null;
      return this.handleBuyAction(item.name.toLowerCase());
    }

    const category = this.pendingMenu.categories[index];
    if (!category) {
      this.pendingMenu = null;
      return {
        narrative: "Такого каталога нет.",
        system: "Попробуйте другой."
      };
    }

    const filtered = this.pendingMenu.stock.filter((item) => item.category === category);
    this.pendingMenu.view = "category";
    this.pendingMenu.filtered = filtered;
    this.pendingMenu.options = filtered.map((item) => item.name);

    return {
      narrative: `Каталог: ${category}.`,
      options: filtered.map((item, itemIndex) => `${itemIndex + 1}. Купить ${item.name} (${item.price} кр.)`)
    };
  }

  handleMenuSelection(value) {
    const menu = this.pendingMenu;
    if (!menu) {
      return;
    }
    let result = null;
    const menuType = menu.type;
    if (menuType === "phone") {
      result = this.handlePhoneMenuSelection(value);
    }
    if (["shop", "lingerie", "foodshop", "cafe", "tech"].includes(menuType)) {
      result = this.handleShopMenuSelection(value);
    }
    if (menuType === "npc") {
      result = this.handleNpcMenuSelection(value, menu.actionType || "talk");
    }
    if (menuType === "wardrobe") {
      result = this.handleWardrobeMenuSelection(value);
    }
    if (menuType === "eat") {
      result = this.handleEatMenuSelection(value);
    }
    if (menuType === "hair") {
      result = this.handleHairMenuSelection(value);
    }
    if (menuType === "phone-contacts") {
      result = this.handlePhoneContactsSelection(value);
    }
    if (menuType === "phone-add") {
      result = this.handlePhoneAddContactSelection(value);
    }

    if (result) {
      this.reset();
      this.renderer.renderEntry(result);
      this.renderStatus();
      this.renderMap();
      this.renderAvailableActions();
      this.renderActionButtons();
    }
  }

  getPhoneMenuOptions() {
    const options = ["Проверить статус", "Контакты", "Добавить контакт", "Развлечься", "Сделать фото"];
    if (this.character.job !== "курьер") {
      options.unshift("Устроиться курьером");
    }
    options.push("Закрыть телефон");
    return options;
  }

  getShopCategories(stock) {
    const categories = Array.from(new Set(stock.map((item) => item.category))).filter(Boolean);
    return categories.length ? categories : ["прочее"];
  }

  getClothingSlot(item) {
    const category = item.category;
    if (category === "верх") return "верх";
    if (category === "низ" || category === "штаны") return "низ";
    if (category === "обувь") return "обувь";
    if (category === "белье") return "белье";
    return "верх";
  }

  getEquipmentSlot(item) {
    if (item.type === "device") return "гаджет";
    return this.getClothingSlot(item);
  }

  equipStarterOutfit() {
    const outfitIds =
      this.character.gender === "женский"
        ? ["womens-top", "womens-skirt", "womens-shoes", "womens-underwear"]
        : ["mens-tshirt", "mens-jeans", "mens-shoes", "mens-underwear"];
    outfitIds.forEach((id) => {
      const item = this.data.items.find((entry) => entry.id === id);
      if (item) {
        this.character.inventory.add(item);
        const slot = this.getEquipmentSlot(item);
        this.character.equipItem(slot, item);
        this.character.inventory.remove(item.id);
      }
    });
    const phone = this.data.items.find((entry) => entry.id === "phone");
    if (phone) {
      this.character.equipItem("гаджет", phone);
      this.character.inventory.remove(phone.id);
    }
  }

  normalizeSlot(rawSlot) {
    if (!rawSlot) return null;
    const slot = rawSlot.toLowerCase();
    if (["верх", "низ", "обувь", "белье", "гаджет"].includes(slot)) return slot;
    return null;
  }

  handleWardrobeAction() {
    const clothingItems = this.character.inventory.items.filter(
      (item) => item.type === "clothing" || item.type === "device"
    );
    const equipOptions = clothingItems.map((item) => `Надеть: ${item.name}`);
    const unequipOptions = Object.entries(this.character.equipment)
      .filter(([, item]) => item)
      .map(([slot, item]) => `Снять: ${slot} (${item.name})`);
    const options = [...equipOptions, ...unequipOptions];

    if (!options.length) {
      return {
        narrative: "В гардеробе пока пусто.",
        system: "Купите одежду, чтобы переодеваться."
      };
    }

    this.pendingMenu = {
      type: "wardrobe",
      options
    };

    return {
      narrative: "Гардероб открыт.",
      options: options.map((option, index) => `${index + 1}. ${option}`)
    };
  }

  handleWardrobeMenuSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return {
        narrative: "Выберите номер.",
        system: "Например: 1"
      };
    }
    const option = this.pendingMenu.options[index];
    if (!option) {
      this.pendingMenu = null;
      return {
        narrative: "Такого номера нет.",
        system: "Попробуйте другой."
      };
    }
    if (option.startsWith("Надеть:")) {
      const itemName = option.replace("Надеть:", "").trim().toLowerCase();
      this.pendingMenu = null;
      return this.handleWearAction(itemName);
    }
    if (option.startsWith("Снять:")) {
      const slot = option.split(":")[1].trim().split(" ")[0];
      this.pendingMenu = null;
      return this.handleRemoveAction(slot);
    }
    this.pendingMenu = null;
    return { narrative: "Гардероб закрыт." };
  }

  handleWearAction(rawItemName) {
    if (!rawItemName) {
      return {
        narrative: "Укажите, что надеть.",
        system: "Например: надеть Мужская рубашка."
      };
    }
    const itemIndex = this.character.inventory.items.findIndex(
      (entry) =>
        entry.name.toLowerCase() === rawItemName &&
        (entry.type === "clothing" || entry.type === "device")
    );
    const item = itemIndex !== -1 ? this.character.inventory.items[itemIndex] : null;
    if (!item) {
      return {
        narrative: "Такой вещи нет в инвентаре.",
        system: "Откройте гардероб для выбора."
      };
    }
    if (item.type === "clothing" && item.gender !== "унисекс" && item.gender !== this.character.gender) {
      return {
        narrative: "Эта вещь не подходит по полу.",
        system: "Выберите подходящий вариант."
      };
    }
    const slot = this.getEquipmentSlot(item);
    const previous = this.character.equipment[slot];
    if (previous) {
      this.character.inventory.add(previous);
    }
    this.character.inventory.items.splice(itemIndex, 1);
    this.character.equipItem(slot, item);
    return {
      narrative: `Вы надеваете «${item.name}».`,
      system: `Слот: ${slot}.`
    };
  }

  handleRemoveAction(rawSlot) {
    const slot = this.normalizeSlot(rawSlot);
    if (!slot) {
      return {
        narrative: "Укажите слот для снятия.",
        system: "Например: снять верх."
      };
    }
    if (!this.character.equipment[slot]) {
      return {
        narrative: "В этом слоте ничего не надето.",
        system: "Попробуйте другой слот."
      };
    }
    const itemName = this.character.equipment[slot].name;
    this.character.inventory.add(this.character.equipment[slot]);
    this.character.unequipItem(slot);
    return {
      narrative: `Вы снимаете «${itemName}».`,
      system: `Слот: ${slot}.`
    };
  }

  handleEatAction() {
    const foodItems = this.character.inventory.items.filter((item) => item.type === "food");
    if (!foodItems.length) {
      return {
        narrative: "В инвентаре нет еды.",
        system: "Загляните в магазин еды или кафе."
      };
    }
    this.pendingMenu = {
      type: "eat",
      items: foodItems,
      options: foodItems.map((item) => item.name)
    };
    return {
      narrative: "Что съесть?",
      options: foodItems.map((item, index) => `${index + 1}. ${item.name}`)
    };
  }

  handleEatMenuSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return {
        narrative: "Выберите номер блюда.",
        system: "Например: 1"
      };
    }
    const item = this.pendingMenu.items[index];
    if (!item) {
      this.pendingMenu = null;
      return {
        narrative: "Такого блюда нет.",
        system: "Попробуйте другой."
      };
    }
    this.character.inventory.remove(item.id);
    this.character.applyChange({ hunger: item.nutrition || 15, morale: 2 });
    this.pendingMenu = null;
    return {
      narrative: `Вы едите «${item.name}».`,
      system: `Голод восстановлен на ${item.nutrition || 15}.`
    };
  }

  handleCookAction() {
    if (this.world.activePlace !== "дом") {
      return {
        narrative: "Готовить можно только дома.",
        system: "Переместитесь в «старый, дом»."
      };
    }
    const ingredients = this.character.inventory.items.filter(
      (item) => item.type === "food" && item.category === "ингредиенты"
    );
    if (ingredients.length < 2) {
      return {
        narrative: "Недостаточно ингредиентов для готовки.",
        system: "Купите продукты в магазине еды."
      };
    }
    const used = ingredients.slice(0, 2);
    used.forEach((item) => this.character.inventory.remove(item.id));
    const meal = this.data.items.find((item) => item.id === "bento") || {
      id: "home-meal",
      name: "Домашний обед",
      weight: 1,
      type: "food",
      nutrition: 30
    };
    this.character.inventory.add(meal);
    this.character.applyChange({ morale: 2, energy: -2, leisure: 2 });
    return {
      narrative: "Вы готовите простой домашний обед.",
      system: "Блюдо добавлено в инвентарь."
    };
  }

  handleHairAction() {
    if (this.world.activePlace !== "парикмахерская") {
      return {
        narrative: "Парикмахерская находится в старом районе.",
        system: "Переместитесь в «старый, парикмахерская»."
      };
    }
    const styles = ["короткая", "каре", "длинная", "волнистая", "аккуратная"];
    const colors = ["темный", "каштановый", "светлый", "черный", "медный"];
    this.pendingMenu = {
      type: "hair",
      options: [...styles.map((style) => `Стиль: ${style}`), ...colors.map((color) => `Цвет: ${color}`)]
    };
    return {
      narrative: "Выбирайте стиль и цвет.",
      options: this.pendingMenu.options.map((option, index) => `${index + 1}. ${option}`)
    };
  }

  handleHairMenuSelection(selection) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return { narrative: "Выберите номер." };
    }
    const option = this.pendingMenu.options[index];
    if (!option) {
      this.pendingMenu = null;
      return { narrative: "Такого варианта нет." };
    }
    if (option.startsWith("Стиль:")) {
      this.character.appearance.hairStyle = option.replace("Стиль:", "").trim();
    }
    if (option.startsWith("Цвет:")) {
      this.character.appearance.hairColor = option.replace("Цвет:", "").trim();
    }
    this.character.applyChange({ morale: 1, money: -15 });
    this.pendingMenu = null;
    return {
      narrative: "Вы обновляете прическу.",
      system: `Стиль: ${this.character.appearance.hairStyle || "не задан"}. Цвет: ${this.character.appearance.hairColor || "не задан"}.`
    };
  }
  handleBuyAction(rawItemName) {
    const validPlaces = ["магазин одежды", "магазин белья", "магазин еды", "кафе", "магазин техники"];
    if (!validPlaces.includes(this.world.activePlace)) {
      return {
        narrative: "Покупки доступны только в магазинах или кафе.",
        system: "Переместитесь в подходящее место."
      };
    }

    if (!rawItemName) {
      return {
        narrative: "Укажите название вещи для покупки.",
        system: "Например: купить Женская куртка."
      };
    }

    const shopType = this.world.activePlace === "магазин белья"
      ? "lingerie"
      : this.world.activePlace === "магазин еды"
        ? "food"
        : this.world.activePlace === "кафе"
          ? "cafe"
          : this.world.activePlace === "магазин техники"
            ? "tech"
            : "clothing";
    const stock = this.getShopStock(shopType);
    const item = stock.find((entry) => entry.name.toLowerCase() === rawItemName);
    if (!item) {
      return {
        narrative: "Такой вещи нет в наличии.",
        system: "Откройте список магазина командой «магазин»."
      };
    }

    const price = item.price || 60;
    if (this.character.money < price) {
      return {
        narrative: "Недостаточно средств для покупки.",
        system: `Нужно ${price} кредитов.`
      };
    }

    if (!this.character.inventory.add(item)) {
      return {
        narrative: "Инвентарь перегружен.",
        system: "Освободите место."
      };
    }

    if (item.type === "tech") {
      if (!this.character.property.devices) {
        this.character.property.devices = [];
      }
      this.character.property.devices.push(item.name);
      this.character.inventory.remove(item.id);
    }

    this.character.applyChange({ money: -price, morale: 2 });
    return {
      narrative: `Вы покупаете «${item.name}» и чувствуете обновление образа.`,
      system: `Списано ${price} кредитов.`
    };
  }

  getShopStock(shopType = "clothing") {
    const gender = this.character.gender;
    if (shopType === "food") {
      return this.data.items
        .filter((item) => item.type === "food" && item.category === "ингредиенты")
        .map((item) => ({ ...item, price: item.price || 20 }));
    }
    if (shopType === "cafe") {
      return this.data.items
        .filter((item) => item.type === "food" && item.category === "готовая еда")
        .map((item) => ({ ...item, price: item.price || 50 }));
    }
    if (shopType === "tech") {
      return this.data.items
        .filter((item) => item.type === "device" || item.type === "tech")
        .map((item) => ({ ...item, price: item.price || 120 }));
    }
    const clothingItems = this.data.items
      .filter((item) => item.type === "clothing")
      .filter((item) => item.gender === "унисекс" || item.gender === gender);
    const filtered =
      shopType === "lingerie"
        ? clothingItems.filter((item) => item.category === "белье")
        : clothingItems.filter((item) => item.category !== "белье");
    return filtered.map((item) => ({ ...item, price: item.price || 60 }));
  }

  getAvailableActions() {
    const actions = [];
    const places = CITY_MAP[this.world.activeDistrict] || [];
    places.forEach((place) => {
      if (place !== this.world.activePlace) {
        actions.push(`Перейти: ${place}`);
      }
    });
    Object.keys(CITY_MAP).forEach((district) => {
      if (district !== this.world.activeDistrict) {
        actions.push(`Перейти: ${district}`);
      }
    });
    actions.push("Осмотреться", "Карта", "Общаться");

    if (this.world.activePlace === "магазин одежды") {
      actions.push("Магазин одежды");
    }
    if (this.world.activePlace === "магазин белья") {
      actions.push("Магазин белья");
    }
    if (this.world.activePlace === "магазин еды") {
      actions.push("Магазин еды");
    }
    if (this.world.activePlace === "магазин техники") {
      actions.push("Магазин техники");
    }
    if (this.world.activePlace === "кафе") {
      actions.push("Кафе");
    }
    if (this.world.activePlace === "дом") {
      actions.push("Готовить");
    }
    if (this.world.activePlace === "парикмахерская") {
      actions.push("Парикмахерская");
    }

    if (this.isPhoneAvailable()) {
      actions.push("Телефон");
    }

    if (this.character.inventory.items.some((item) => item.type === "food")) {
      actions.push("Поесть");
    }

    if (this.character.inventory.items.some((item) => item.type === "clothing" || item.type === "device")) {
      actions.push("Гардероб");
    }

    const nearby = this.getNearbyNpcs();
    if (nearby.length) {
      actions.push("НПС", "Поговорить", "Флиртовать", "Подружиться");
    }

    if (this.character.job === "курьер") {
      if (!this.activeDelivery && this.world.activePlace === "офис") {
        actions.push("Работа");
      }
      if (this.activeDelivery && !this.activeDelivery.pickedUp && this.world.activePlace === "офис") {
        actions.push("Взять заказ");
      }
      if (this.activeDelivery?.pickedUp) {
        const { dropoff } = this.activeDelivery;
        if (
          this.world.activeDistrict === dropoff.district &&
          this.world.activePlace === dropoff.place
        ) {
          actions.push("Доставить заказ");
        }
      }
    }

    return actions;
  }

  getContextualActions() {
    if (this.pendingMenu?.options) {
      return this.pendingMenu.options.map((option, index) => ({
        label: `${index + 1}. ${option}`,
        value: String(index + 1)
      }));
    }
    const actions = [];
    actions.push({ label: "Осмотреться", value: "осмотреться" });
    actions.push({ label: "Карта", value: "карта" });

    if (this.isPhoneAvailable()) {
      actions.push({ label: "Телефон", value: "телефон" });
    }

    if (this.world.activePlace === "магазин одежды") {
      actions.push({ label: "Каталог одежды", value: "магазин" });
    }
    if (this.world.activePlace === "магазин белья") {
      actions.push({ label: "Каталог белья", value: "магазин белья" });
    }
    if (this.world.activePlace === "магазин еды") {
      actions.push({ label: "Магазин еды", value: "магазин еды" });
    }
    if (this.world.activePlace === "магазин техники") {
      actions.push({ label: "Магазин техники", value: "магазин техники" });
    }
    if (this.world.activePlace === "кафе") {
      actions.push({ label: "Кафе", value: "кафе" });
    }
    if (this.world.activePlace === "дом") {
      actions.push({ label: "Готовить", value: "готовить" });
    }
    if (this.world.activePlace === "парикмахерская") {
      actions.push({ label: "Парикмахерская", value: "парикмахерская" });
    }

    if (this.character.inventory.items.some((item) => item.type === "food")) {
      actions.push({ label: "Поесть", value: "поесть" });
    }

    const nearby = this.getNearbyNpcs();
    if (nearby.length) {
      actions.push({ label: "НПС", value: "нпс" });
      actions.push({ label: "Поговорить", value: "поговорить" });
      actions.push({ label: "Подружиться", value: "подружиться" });
      actions.push({ label: "Флиртовать", value: "флиртовать" });
    }

    if (this.character.inventory.items.some((item) => item.type === "clothing" || item.type === "device")) {
      actions.push({ label: "Гардероб", value: "гардероб" });
    }

    if (this.character.job === "курьер") {
      if (!this.activeDelivery && this.world.activePlace === "офис") {
        actions.push({ label: "Работа", value: "работа" });
      }
      if (this.activeDelivery && !this.activeDelivery.pickedUp && this.world.activePlace === "офис") {
        actions.push({ label: "Взять заказ", value: "взять заказ" });
      }
      if (this.activeDelivery?.pickedUp) {
        const { dropoff } = this.activeDelivery;
        if (
          this.world.activeDistrict === dropoff.district &&
          this.world.activePlace === dropoff.place
        ) {
          actions.push({ label: "Доставить заказ", value: "доставить заказ" });
        }
      }
    }

    return actions;
  }

  isPhoneAvailable() {
    const gadget = this.character.equipment["гаджет"];
    return Boolean(gadget && gadget.type === "device");
  }

  renderMap() {
    if (!this.mapElement) return;
    this.mapElement.innerHTML = "";
    Object.entries(CITY_MAP).forEach(([district, places]) => {
      const label = document.createElement("div");
      label.className = "location";
      if (district === this.world.activeDistrict) {
        label.classList.add("active");
      }
      const suffix =
        district === this.world.activeDistrict
          ? ` (текущая точка: ${this.world.activePlace})`
          : "";
      label.textContent = `${district}: ${places.join(", ")}${suffix}`;
      this.mapElement.appendChild(label);
    });
  }

  renderAvailableActions() {
    if (!this.availableActionsElement) return;
    this.availableActionsElement.innerHTML = "";
    this.getAvailableActions().forEach((action) => {
      const item = document.createElement("li");
      item.textContent = action;
      this.availableActionsElement.appendChild(item);
    });
  }

  renderActionButtons() {
    if (!this.actionButtonsElement) return;
    this.actionButtonsElement.innerHTML = "";
    const actions = this.getContextualActions();
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.dataset.action = action.value;
      this.actionButtonsElement.appendChild(button);
    });
  }

  renderNpcList() {
    const nearby = this.getNearbyNpcs();
    const info = nearby.length
      ? `Рядом: ${nearby.map((npc) => npc.name).join(", ")}.`
      : "Поблизости никого нет.";
    this.renderer.renderEntry({
      system: info
    });
  }

  renderStatus() {
    this.renderPlayerPanel();
  }

  renderPlayerPanel() {
    if (!this.playerContentElement) return;
    const tabs = this.playerTabsElement?.querySelectorAll("button[data-tab]") || [];
    tabs.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === this.activePlayerTab);
    });

    this.playerContentElement.innerHTML = "";
    const content = document.createElement("div");
    content.className = "player-sections";
    if ((!this.character || !this.world) && this.activePlayerTab !== "editor") {
      const empty = document.createElement("p");
      empty.className = "editor-empty";
      empty.textContent = "Создайте персонажа, чтобы увидеть данные.";
      content.appendChild(empty);
      this.playerContentElement.appendChild(content);
      return;
    }

    if (this.activePlayerTab === "status") {
      const preview = this.buildLayerPreview();
      if (preview) {
        content.appendChild(preview);
      }
      content.appendChild(
        this.buildTable("Основное", [
          ["HP", this.character.health.hp],
          ["Энергия", this.character.energy],
          ["Голод", this.character.hunger],
          ["Мораль", this.character.morale],
          ["Досуг", this.character.leisure],
          ["Деньги", this.character.money],
          ["Локация", `${this.world.activeDistrict}, ${this.world.activePlace}`]
        ])
      );
      content.appendChild(
        this.buildTable("Социальное", [
          ["Работа", this.character.job],
          ["Привлекательность", this.character.attractiveness],
          ["Популярность", this.character.popularity],
          ...(this.character.gender === "женский" ? [["Сексуальность", this.character.sexuality]] : []),
          ["Статус", this.character.isNaked() ? (this.character.gender === "женский" ? "голая" : "голый") : "одет(а)"]
        ])
      );
    }

    if (this.activePlayerTab === "appearance") {
      const appearanceRows =
        this.character.gender === "мужской"
          ? [
              ["Рост", this.character.appearance.height],
              ["Вес", this.character.appearance.weight],
              ["Плечи", this.character.appearance.shoulders],
              ["Талия", this.character.appearance.waist],
              ["Лицо", this.character.appearance.face],
              ["Размер", this.character.appearance.phallus]
            ]
          : [
              ["Рост", this.character.appearance.height],
              ["Вес", this.character.appearance.weight],
              ["Бедра", this.character.appearance.hips],
              ["Талия", this.character.appearance.waist],
              ["Грудь", this.character.appearance.chest],
              ["Ягодицы", this.character.appearance.glutes],
              ["Лицо", this.character.appearance.face],
              ["Месячные", this.character.menstruation ?? "нет"]
            ];
      content.appendChild(
        this.buildTable("Параметры", [
          ...appearanceRows,
          ["Прическа", this.character.appearance.hairStyle || "не задана"],
          ["Цвет волос", this.character.appearance.hairColor || "не задан"]
        ])
      );
      content.appendChild(
        this.buildTable(
          "Экипировка",
          Object.entries(this.character.equipment).map(([slot, item]) => [slot, item ? item.name : "нет"])
        )
      );
    }

    if (this.activePlayerTab === "inventory") {
      const inventoryRows = this.character.inventory.items.length
        ? this.character.inventory.items.map((item) => [item.name, item.weight])
        : [["Пусто", "0"]];
      content.appendChild(this.buildTable("Инвентарь", inventoryRows));
    }

    if (this.activePlayerTab === "property") {
      content.appendChild(
        this.buildTable("Дом", [
          ["Адрес", this.character.property.address],
          ["Размер", this.character.property.size],
          ["Мебель", this.character.property.furniture.length ? this.character.property.furniture.join(", ") : "Пусто"],
          ["Техника", this.character.property.devices?.length ? this.character.property.devices.join(", ") : "Пусто"]
        ])
      );
      if (this.character.photos.length) {
        const photoRows = this.character.photos.slice(-3).map((photo) => [
          photo.time,
          `${photo.description} (${photo.rating})`
        ]);
        content.appendChild(this.buildTable("Фото", photoRows));
      }
    }

    if (this.activePlayerTab === "editor") {
      content.appendChild(this.renderEditorPanel());
    }

    this.playerContentElement.appendChild(content);
  }

  initializeCharacterLayers() {
    if (!this.data.characterLayers?.categories?.length) return;
    this.characterLayers = this.data.characterLayers;
    if (this.character?.layerSelections) {
      this.applyLayerSelections(this.character.layerSelections);
      return;
    }
    this.layerSelections = this.buildDefaultLayerSelections();
  }

  buildDefaultLayerSelections() {
    const selections = {};
    this.characterLayers?.categories?.forEach((category) => {
      const defaults = category.layers.filter((layer) => layer.default).map((layer) => layer.id);
      if (!defaults.length && category.required && category.layers.length) {
        defaults.push(category.layers[0].id);
      }
      selections[category.id] = new Set(defaults);
    });
    return selections;
  }

  applyLayerSelections(data) {
    if (!this.characterLayers?.categories?.length) {
      this.layerSelections = {};
      return this.layerSelections;
    }
    if (!data || Object.keys(data).length === 0) {
      this.layerSelections = this.buildDefaultLayerSelections();
      return this.layerSelections;
    }
    const defaults = this.buildDefaultLayerSelections();
    const selections = {};
    this.characterLayers.categories.forEach((category) => {
      const stored = Array.isArray(data[category.id]) ? data[category.id] : [];
      const fallback = defaults[category.id] ? Array.from(defaults[category.id]) : [];
      selections[category.id] = new Set(stored.length ? stored : fallback);
    });
    this.layerSelections = selections;
    return this.layerSelections;
  }

  serializeLayerSelections() {
    const serialized = {};
    Object.entries(this.layerSelections || {}).forEach(([categoryId, selection]) => {
      serialized[categoryId] = Array.from(selection);
    });
    return serialized;
  }

  updateLayerSelectionsTarget() {
    const serialized = this.serializeLayerSelections();
    if (this.state === "creating") {
      this.profileDraft.layerSelections = serialized;
    }
    if (this.character) {
      this.character.layerSelections = serialized;
    }
  }

  getActiveLayers() {
    if (!this.characterLayers?.categories) return [];
    const activeLayers = [];
    this.characterLayers.categories.forEach((category) => {
      const selected = this.layerSelections[category.id] || new Set();
      category.layers.forEach((layer) => {
        if (selected.has(layer.id)) {
          activeLayers.push({ ...layer, categoryId: category.id });
        }
      });
    });
    return activeLayers;
  }

  toggleLayerSelection(categoryId, layerId, enabled) {
    if (!this.layerSelections[categoryId]) {
      this.layerSelections[categoryId] = new Set();
    }
    if (enabled) {
      this.layerSelections[categoryId].add(layerId);
    } else {
      this.layerSelections[categoryId].delete(layerId);
    }
    this.updateLayerSelectionsTarget();
  }

  renderEditorPanel() {
    const wrapper = document.createElement("div");
    wrapper.className = "character-editor";

    if (!this.characterLayers?.categories?.length) {
      const notice = document.createElement("p");
      notice.className = "editor-empty";
      notice.textContent = "Нет данных по слоям персонажа. Проверьте data/character_layers.json.";
      wrapper.appendChild(notice);
      return wrapper;
    }

    const preview = document.createElement("div");
    preview.className = "character-preview";

    const stack = this.buildLayerStack();
    preview.appendChild(stack);

    const options = document.createElement("div");
    options.className = "editor-options";

    this.characterLayers.categories.forEach((category) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "editor-group";

      const legend = document.createElement("legend");
      legend.textContent = category.label;
      fieldset.appendChild(legend);

      category.layers.forEach((layer) => {
        const label = document.createElement("label");
        label.className = "editor-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = this.layerSelections[category.id]?.has(layer.id) || false;
        checkbox.disabled = Boolean(layer.locked);
        checkbox.addEventListener("change", () => {
          this.toggleLayerSelection(category.id, layer.id, checkbox.checked);
          if (category.required && !this.layerSelections[category.id]?.size) {
            checkbox.checked = true;
            this.toggleLayerSelection(category.id, layer.id, true);
          }
          this.renderPlayerPanel();
        });

        const text = document.createElement("span");
        text.textContent = layer.label;
        label.appendChild(checkbox);
        label.appendChild(text);
        fieldset.appendChild(label);
      });

      options.appendChild(fieldset);
    });

    wrapper.appendChild(preview);
    wrapper.appendChild(options);
    return wrapper;
  }

  buildLayerPreview() {
    if (!this.characterLayers?.categories?.length) return null;
    const preview = document.createElement("div");
    preview.className = "character-preview";
    const stack = this.buildLayerStack();
    preview.appendChild(stack);
    return preview;
  }

  buildLayerStack() {
    const stack = document.createElement("div");
    stack.className = "preview-stack";
    const activeLayers = this.getActiveLayers();
    if (!activeLayers.length) {
      const empty = document.createElement("span");
      empty.textContent = "Слои не выбраны.";
      stack.appendChild(empty);
      return stack;
    }
    activeLayers.forEach((layer) => {
      if (layer.asset) {
        const img = document.createElement("img");
        img.src = layer.asset;
        img.alt = layer.label;
        img.loading = "lazy";
        img.addEventListener("error", () => {
          img.remove();
        });
        stack.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "layer-placeholder";
        placeholder.textContent = layer.label;
        stack.appendChild(placeholder);
      }
    });
    return stack;
  }

  buildTable(title, rows) {
    const wrapper = document.createElement("details");
    wrapper.className = "table-wrapper";
    wrapper.open = true;

    const summary = document.createElement("summary");
    summary.textContent = title;
    wrapper.appendChild(summary);

    const table = document.createElement("table");
    table.className = "markdown-table";
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }

  spawnNpcs(limit) {
    this.activeNpcIds = this.npcs.slice(0, limit).map((npc) => npc.id);
  }

  moveNpcs() {
    this.npcs.forEach((npc) => {
      if (!this.activeNpcIds.includes(npc.id)) return;
      if (Randomizer.roll(40)) {
        npc.district = Randomizer.pick(Object.keys(CITY_MAP));
        npc.place = Randomizer.pick(CITY_MAP[npc.district]);
      }
    });
  }

  getNearbyNpcs() {
    return this.npcs.filter(
      (npc) =>
        this.activeNpcIds.includes(npc.id) &&
        npc.district === this.world.activeDistrict &&
        npc.place === this.world.activePlace
    );
  }

  handleNpcList() {
    const nearby = this.getNearbyNpcs();
    if (!nearby.length) {
      return {
        narrative: "Поблизости нет знакомых.",
        system: "Попробуйте сменить локацию."
      };
    }

    this.pendingMenu = {
      type: "npc",
      options: nearby.map((npc) => npc.name),
      npcs: nearby
    };

    return {
      narrative: "Вы видите рядом несколько людей.",
      options: nearby.map((npc, index) => `${index + 1}. ${npc.name} (${npc.role})`)
    };
  }

  handleNpcMenuSelection(selection, actionType) {
    const index = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(index) || index < 0) {
      this.pendingMenu = null;
      return {
        narrative: "Выберите номер персонажа.",
        system: "Например: 1"
      };
    }
    const npc = this.pendingMenu.npcs[index];
    if (!npc) {
      this.pendingMenu = null;
      return {
        narrative: "Такого номера нет.",
        system: "Попробуйте другой."
      };
    }
    this.pendingMenu = null;
    return this.resolveNpcInteraction(npc, actionType);
  }

  handleNpcInteraction(actionType) {
    const nearby = this.getNearbyNpcs();
    if (!nearby.length) {
      return {
        narrative: "Никого рядом нет.",
        system: "Смените локацию."
      };
    }
    this.pendingMenu = {
      type: "npc",
      actionType,
      options: nearby.map((npc) => npc.name),
      npcs: nearby
    };

    return {
      narrative: "Кого вы хотите выбрать?",
      options: nearby.map((npc, index) => `${index + 1}. ${npc.name} (${npc.role})`)
    };
  }

  resolveNpcInteraction(npc, actionType) {
    const base = actionType === "flirt" ? 45 : actionType === "befriend" ? 50 : 55;
    const nudityPenalty = this.character.isNaked() ? -25 : 0;
    const chance = this.getStatCheck("charisma", base + nudityPenalty);
    const success = Randomizer.roll(chance);
    const delta = success ? 5 : this.character.isNaked() ? -6 : -2;
    npc.relationship = Randomizer.clamp(npc.relationship + delta, -100, 100);
    this.character.applyChange({ morale: success ? 2 : -1, energy: -1 });

    const actionLabel =
      actionType === "flirt" ? "флиртуете" : actionType === "befriend" ? "налаживаете контакт" : "разговариваете";
    return {
      narrative: `Вы ${actionLabel} с ${npc.name}.`,
      system: `Отношение: ${npc.relationship} (${success ? "+" : ""}${delta}).${
        this.character.isNaked() ? " Выглядите неуместно, и это замечают." : ""
      }`
    };
  }

  enableInput(state) {
    this.input.disabled = !state;
    this.sendAction.disabled = !state;
  }

  save() {
    if (!this.character) return;
    this.character.layerSelections = this.serializeLayerSelections();
    const payload = {
      character: this.character,
      world: this.world
    };
    localStorage.setItem("neon-boroughs-save", JSON.stringify(payload));
    this.renderer.renderEntry({ system: "Игра сохранена." });
  }

  load() {
    const raw = localStorage.getItem("neon-boroughs-save");
    if (!raw) {
      this.renderer.renderEntry({ system: "Сохранение не найдено." });
      return;
    }
    const payload = JSON.parse(raw);
    this.character = new Character(payload.character);
    this.applyLayerSelections(this.character.layerSelections);
    this.world = new World({
      districts: payload.world.districts,
      startDistrict: payload.world.activeDistrict,
      startPlace: payload.world.activePlace
    });
    this.world.time = payload.world.time;
    this.eventManager = new EventManager(this.data.events);

    this.state = "playing";
    this.activePlayerTab = "status";
    this.enableInput(true);
    this.nextTurn.disabled = false;
    this.saveGame.disabled = false;

    this.renderer.renderEntry({
      narrative: "Сохранение загружено. Город вновь оживает.",
      system: "Продолжайте приключение."
    });
    this.renderStatus();
    this.renderMap();
    this.renderAvailableActions();
    this.moveNpcs();
    this.renderNpcList();
    this.renderActionButtons();
  }

  reset() {
    this.logElement.innerHTML = "";
  }
}

new Game();
