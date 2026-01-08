const DATA_PATHS = {
  items: "data/items.json",
  phrases: "data/phrases.json",
  events: "data/events.json",
  npcs: "data/npcs.json"
};

const CREATION_OPTIONS = {
  genders: ["мужской", "женский"],
  jobs: ["безработный", "студент", "фрилансер"],
  traits: ["смелый", "осторожный", "общительный", "наблюдательный"],
  backgrounds: ["дом", "улица", "учеба", "работа"]
};

const CITY_MAP = {
  порт: ["набережная", "рыбный рынок", "кафе", "офис"],
  старый: ["улочки", "дом", "мастерская"],
  центр: ["площадь", "магазин одежды", "магазин белья", "магазин еды"],
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
    this.money = profile.money;
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
      белье: null
    };
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
  }

  isNaked() {
    return Object.values(this.equipment).every((item) => !item);
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
    if (clean.includes("белье") && clean.includes("магазин")) {
      return { intent: "lingerie" };
    }
    if (clean.includes("еда") || clean.includes("продукт")) {
      return { intent: "foodshop" };
    }
    if (clean.includes("кафе")) {
      return { intent: "cafe" };
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

  renderTable({ headers, rows }) {
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

    return table;
  }
}

class Game {
  constructor() {
    this.logElement = document.getElementById("log");
    this.mapElement = document.getElementById("map");
    this.availableActionsElement = document.getElementById("available-actions");
    this.actionButtonsElement = document.getElementById("action-buttons");
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
      npcs: []
    };

    this.state = "idle";
    this.character = null;
    this.world = null;
    this.npcs = [];
    this.eventManager = null;
    this.pendingMenu = null;
    this.activeNpcIds = [];
    this.activeDelivery = null;

    this.creationQueue = [];
    this.currentQuestion = 0;
    this.profileDraft = {};

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
  }

  async bootstrap() {
    await this.loadData();
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
          return [key, key === "phrases" ? {} : []];
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
      money: 120,
      reputation: { police: 0, underworld: 0, syndicate: 0 },
      relationships: [],
      inventory: new Inventory(25),
      property: { address: "Старый квартал", size: "комната", furniture: [] },
      menstruation: null,
      equipment: { верх: null, низ: null, обувь: null, белье: null }
    };
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
    const questions = [appearanceQuestion];
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
    this.character = new Character(this.profileDraft);
    const starterItems = this.data.items.filter((item) => ["cash", "phone"].includes(item.id));
    starterItems.forEach((item) => this.character.inventory.add(item));
    this.equipStarterOutfit();
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
    const hasPhone = this.character.inventory.items.some((item) => item.id === "phone");
    if (!hasPhone) {
      return {
        narrative: "Без телефона связь с миром ограничена.",
        system: "Найдите устройство или купите его."
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
    if (stock.length === 0) {
      return { narrative: "Сегодняшнее меню уже разобрали." };
    }

    this.pendingMenu = {
      type: "cafe",
      stock,
      view: "category",
      filtered: stock,
      options: stock.map((item) => item.name)
    };

    return {
      narrative: "Меню кафе на сегодня.",
      options: stock.map((item, index) => `${index + 1}. ${item.name} (${item.price} кр.)`)
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
    let result = null;
    if (this.pendingMenu.type === "phone") {
      result = this.handlePhoneMenuSelection(value);
    }
    if (["shop", "lingerie", "foodshop", "cafe"].includes(this.pendingMenu.type)) {
      result = this.handleShopMenuSelection(value);
    }
    if (this.pendingMenu.type === "npc") {
      result = this.handleNpcMenuSelection(value, this.pendingMenu.actionType || "talk");
    }
    if (this.pendingMenu.type === "wardrobe") {
      result = this.handleWardrobeMenuSelection(value);
    }
    if (this.pendingMenu.type === "eat") {
      result = this.handleEatMenuSelection(value);
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
    const options = ["Проверить статус"];
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

  equipStarterOutfit() {
    const outfitIds =
      this.character.gender === "женский"
        ? ["womens-top", "womens-skirt", "womens-shoes", "womens-underwear"]
        : ["mens-tshirt", "mens-jeans", "mens-shoes", "mens-underwear"];
    outfitIds.forEach((id) => {
      const item = this.data.items.find((entry) => entry.id === id);
      if (item) {
        this.character.inventory.add(item);
        const slot = this.getClothingSlot(item);
        this.character.equipItem(slot, item);
      }
    });
  }

  normalizeSlot(rawSlot) {
    if (!rawSlot) return null;
    const slot = rawSlot.toLowerCase();
    if (["верх", "низ", "обувь", "белье"].includes(slot)) return slot;
    return null;
  }

  handleWardrobeAction() {
    const clothingItems = this.character.inventory.items.filter((item) => item.type === "clothing");
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
    const item = this.character.inventory.items.find(
      (entry) => entry.name.toLowerCase() === rawItemName && entry.type === "clothing"
    );
    if (!item) {
      return {
        narrative: "Такой вещи нет в инвентаре.",
        system: "Откройте гардероб для выбора."
      };
    }
    if (item.gender !== "унисекс" && item.gender !== this.character.gender) {
      return {
        narrative: "Эта вещь не подходит по полу.",
        system: "Выберите подходящий вариант."
      };
    }
    const slot = this.getClothingSlot(item);
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
    this.character.applyChange({ morale: 2, energy: -2 });
    return {
      narrative: "Вы готовите простой домашний обед.",
      system: "Блюдо добавлено в инвентарь."
    };
  }
  handleBuyAction(rawItemName) {
    const validPlaces = ["магазин одежды", "магазин белья", "магазин еды", "кафе"];
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
    if (this.world.activePlace === "кафе") {
      actions.push("Кафе");
    }
    if (this.world.activePlace === "дом") {
      actions.push("Готовить");
    }

    if (this.character.inventory.items.some((item) => item.id === "phone")) {
      actions.push("Телефон");
    }

    if (this.character.inventory.items.some((item) => item.type === "food")) {
      actions.push("Поесть");
    }

    if (this.character.inventory.items.some((item) => item.type === "clothing")) {
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
        label: option,
        value: String(index + 1)
      }));
    }
    const actions = [];
    actions.push({ label: "Осмотреться", value: "осмотреться" });
    actions.push({ label: "Карта", value: "карта" });

    if (this.character.inventory.items.some((item) => item.id === "phone")) {
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
    if (this.world.activePlace === "кафе") {
      actions.push({ label: "Кафе", value: "кафе" });
    }
    if (this.world.activePlace === "дом") {
      actions.push({ label: "Готовить", value: "готовить" });
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

    if (this.character.inventory.items.some((item) => item.type === "clothing")) {
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
    const statsTable = {
      headers: ["Стат", "Значение"],
      rows: [
        ["Сила", this.character.stats.strength],
        ["Ловкость", this.character.stats.agility],
        ["Гибкость", this.character.stats.flexibility],
        ["Харизма", this.character.stats.charisma],
        ["Интеллект", this.character.stats.intellect]
      ]
    };

    const healthTable = {
      headers: ["Показатель", "Значение"],
      rows: [
        ["HP", this.character.health.hp],
        ["Энергия", this.character.energy],
        ["Мораль", this.character.morale],
        ["Голод", this.character.hunger],
        ["Деньги", `${this.character.money}`],
        ["Работа", this.character.job],
        ["День", this.world.time.day],
        ["Час", `${this.world.time.hour}:00`],
        ["Локация", `${this.world.activeDistrict}, ${this.world.activePlace}`],
        ["Статус", this.character.isNaked() ? (this.character.gender === "женский" ? "голая" : "голый") : "одет(а)"]
      ]
    };

    const inventoryTable = {
      headers: ["Инвентарь", "Вес"],
      rows: this.character.inventory.items.length
        ? this.character.inventory.items.map((item) => [item.name, item.weight])
        : [["Пусто", "0"]]
    };

    const propertyTable = {
      headers: ["Имущество", "Описание"],
      rows: [
        ["Адрес", this.character.property.address],
        ["Размер", this.character.property.size],
        ["Мебель", this.character.property.furniture.length ? this.character.property.furniture.join(", ") : "Пусто"]
      ]
    };

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

    const appearanceTable = {
      headers: ["Внешность", "Значение"],
      rows: appearanceRows
    };

    const equipmentTable = {
      headers: ["Одежда", "Надето"],
      rows: Object.entries(this.character.equipment).map(([slot, item]) => [
        slot,
        item ? item.name : "нет"
      ])
    };

    this.renderer.renderEntry({
      system: "Статус обновлен.",
      tables: [statsTable, healthTable, appearanceTable, equipmentTable, inventoryTable, propertyTable]
    });
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
    this.world = new World({
      districts: payload.world.districts,
      startDistrict: payload.world.activeDistrict,
      startPlace: payload.world.activePlace
    });
    this.world.time = payload.world.time;
    this.eventManager = new EventManager(this.data.events);

    this.state = "playing";
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
