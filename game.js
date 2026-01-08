const DATA_PATHS = {
  items: "data/items.json",
  phrases: "data/phrases.json",
  events: "data/events.json",
  npcs: "data/npcs.json"
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
    this.reputation = profile.reputation;
    this.relationships = profile.relationships;
    if (profile.inventory instanceof Inventory) {
      this.inventory = profile.inventory;
    } else {
      this.inventory = new Inventory(profile.inventory?.limit || 25);
      this.inventory.items = profile.inventory?.items || [];
    }
    this.property = profile.property;
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
  }
}

class NPC {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.role = data.role;
    this.schedule = data.schedule;
    this.relationship = data.relationship || 0;
  }
}

class World {
  constructor(config) {
    this.districts = config.districts;
    this.time = { day: 1, hour: 8 };
    this.activeDistrict = config.startDistrict;
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
    if (clean.includes("бар")) {
      return { intent: "go", target: "бар" };
    }
    if (clean.includes("дом")) {
      return { intent: "go", target: "дом" };
    }
    if (clean.includes("работ")) {
      return { intent: "work" };
    }
    if (clean.includes("общ")) {
      return { intent: "social" };
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
    this.logElement.scrollTop = this.logElement.scrollHeight;
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
  }

  async bootstrap() {
    await this.loadData();
    this.renderer.renderEntry({
      narrative: "Город мерцает неоном, а ваши возможности — ровно настолько широки, насколько вы решитесь их расширить.",
      system: "Нажмите «Создать персонажа», чтобы начать новое приключение."
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
      appearance: { height: 170, weight: 65, hips: 5, waist: 5, chest: 5, glutes: 5, face: 6 },
      health: { hp: 100 },
      energy: 80,
      morale: 10,
      reputation: { police: 0, underworld: 0, syndicate: 0 },
      relationships: [],
      inventory: new Inventory(25),
      property: { address: "Не указано", size: "комната", furniture: [] }
    };
    this.creationQueue = [
      { key: "name", prompt: "Имя героя?" },
      { key: "gender", prompt: "Пол/самоопределение?" },
      { key: "age", prompt: "Возраст (18+)?" },
      { key: "job", prompt: "Работа/занятие?" },
      { key: "traits", prompt: "Черты характера (через запятую)?" },
      { key: "background", prompt: "Фон (дом/улица/учеба/работа)?" },
      { key: "stats", prompt: "Распределите 50 очков статов (сила, ловкость, гибкость, харизма, интеллект). Формат: сила 10, ловкость 10, гибкость 10, харизма 10, интеллект 10." },
      { key: "appearance", prompt: "Внешность: рост, вес, бедра, талия, грудь, ягодицы, лицо (1-10). Пример: рост 170, вес 65, бедра 6, талия 5, грудь 5, ягодицы 6, лицо 7." },
      { key: "confirm", prompt: "Подтвердить создание? (да/нет)" }
    ];
    this.currentQuestion = 0;
    this.enableInput(true);
    this.askNextQuestion();
  }

  askNextQuestion() {
    const question = this.creationQueue[this.currentQuestion];
    if (!question) return;
    this.renderer.renderEntry({
      dialogue: `Создание персонажа: ${question.prompt}`,
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

    this.lastAction = value;
    this.runTurn(value);
  }

  handleCreationInput(value) {
    const question = this.creationQueue[this.currentQuestion];
    if (!question) return;

    switch (question.key) {
      case "name":
      case "gender":
      case "job":
      case "background":
        this.profileDraft[question.key] = value;
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
      case "traits":
        this.profileDraft.traits = value.split(",").map((item) => item.trim()).filter(Boolean);
        break;
      case "stats":
        if (!this.applyStats(value)) {
          this.renderer.renderEntry({
            system: "Не удалось разобрать статы или сумма не равна 50. Попробуйте снова."
          });
          return;
        }
        break;
      case "appearance":
        if (!this.applyAppearance(value)) {
          this.renderer.renderEntry({
            system: "Не удалось разобрать внешность. Проверьте формат." 
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
    const map = {
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

  finishCreation() {
    this.character = new Character(this.profileDraft);
    this.data.items.slice(0, 2).forEach((item) => {
      this.character.inventory.add(item);
    });
    this.world = new World({
      districts: ["центр", "трущобы", "элитный", "бар", "тюрьма"],
      startDistrict: this.profileDraft.background?.includes("улиц") ? "трущобы" : "центр"
    });
    this.npcs = this.data.npcs.map((npc) => new NPC(npc));
    this.eventManager = new EventManager(this.data.events);

    this.state = "playing";
    this.enableInput(true);
    this.nextTurn.disabled = false;
    this.saveGame.disabled = false;

    this.renderer.renderEntry({
      narrative: `Добро пожаловать в мегаполис. ${this.character.name} начинает путь в районе: ${this.world.activeDistrict}.`,
      system: "Введите действие или нажмите «Следующий ход»."
    });
    this.renderStatus();
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
  }

  resolveAction(input) {
    const parsed = this.parser.parse(input);
    const responses = this.data.phrases;

    switch (parsed.intent) {
      case "train":
        this.character.applyChange({
          stats: { strength: 1 },
          health: { hp: -1 },
          energy: -6,
          morale: 3
        });
        return {
          narrative: "Вы выбрали тренировку: мышцы горят, но прогресс заметен.",
          system: "Сила +1, Энергия -6, Мораль +3."
        };
      case "go":
        this.world.activeDistrict = parsed.target === "бар" ? "бар" : "центр";
        return {
          narrative: `Вы перемещаетесь в район: ${this.world.activeDistrict}.` 
        };
      case "work":
        this.character.applyChange({
          energy: -8,
          morale: -2
        });
        return {
          narrative: "Рабочий день прошел напряженно, но стабильность — тоже ресурс.",
          system: "Энергия -8, Мораль -2."
        };
      case "social":
        return {
          narrative: "Вы решаете пообщаться и разведать настроение района.",
          dialogue: Randomizer.pick(responses.smalltalk || ["Сосед: " + "Неон снова меркнет, а я только кофе налил."])
        };
      case "free":
        return {
          narrative: "Ваше действие добавлено в дневник. Мир отвечает лаконично, но запоминает всё.",
          system: `Введено: ${parsed.text}`
        };
      default:
        return {
          narrative: "Вы делаете паузу, оценивая варианты.",
          options: ["Тренироваться", "Пойти в бар", "Проверить дом"]
        };
    }
  }

  applyPassiveEffects() {
    if (this.character.energy <= 20) {
      this.character.applyChange({ health: { hp: -2 }, morale: -2 });
    }
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
        ["День", this.world.time.day],
        ["Час", `${this.world.time.hour}:00`],
        ["Район", this.world.activeDistrict]
      ]
    };

    const inventoryTable = {
      headers: ["Инвентарь", "Вес"],
      rows: this.character.inventory.items.length
        ? this.character.inventory.items.map((item) => [item.name, item.weight])
        : [["Пусто", "0"]]
    };

    this.renderer.renderEntry({
      system: "Статус обновлен.",
      tables: [statsTable, healthTable, inventoryTable]
    });
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
      startDistrict: payload.world.activeDistrict
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
  }

  reset() {
    this.logElement.innerHTML = "";
  }
}

new Game();
