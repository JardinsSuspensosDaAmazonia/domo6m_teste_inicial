// exports
__ = i18n;

// simple text translater
function i18n(text, lang, translate) {
	lang = lang && _.isString(lang) ? lang.toLowerCase() : i18n.lang();
	text = String(text);

	// translate dictionary, if present
	translate = translate || i18n.translate[lang];

	if (translate) {
		var namespace = text.replace(/^(\w+:)\S.*$|^.*$/, '$1');

		if (namespace) {
			text = text.replace(/^\w+:(\S.*)$/, '$1');

			return _.has(translate, namespace) && _.has(translate[namespace], text) ? translate[namespace][text] : i18n(text, lang, translate[namespace]);
		}
		return _.has(translate, text) ? translate[text] : text;
	}
	return text;
}

_.extend(i18n, {
	BASE_LANG: 'en',
	LOCAL_STORAGE_KEY: 'acidome.i18n.lang'
});

_.extend(i18n, {
	lang: (function() {
		var lang = ko.observable(null);

		var savedLang = 
				// get current lang from local storage (v.2)
				localStorage.getItem(i18n.LOCAL_STORAGE_KEY)
				||
				// try to get lang from cookie (v.1)
				(document.cookie.split('i18n')[1] || '=;').replace(/^=([^;]*);.*$/, '$1');
		
		// to have an actual lang attribute of <html>
		lang.subscribe(function() {
			$('html').attr('lang', lang());
		});
		
		if (savedLang) {
			lang(savedLang);
		}
		
		// listen observable, save to local storage // (v.1 set cookie)
		lang.subscribe(function() {
			// document.cookie = 'i18n=' + lang(); // v.1
			localStorage.setItem(i18n.LOCAL_STORAGE_KEY, lang());
		});
		
		return lang;
	}()),
	langList: [],
	translate: {},
	addLang: function(lang, data) {
		this.translate[lang] = data;
		this.langList.push(lang);
	},
	isLangKnown: function(lang) {
		return _.has(this.translate, lang.toLowerCase());
	},
	langOptions: function() {
		return _.chain(this.langList)
			.map(function(lang) {
				return {
					id: lang,
					name: __(':lang', lang)
				};
			})
			.sortBy('name')
			.value();
	}
});

// ko.binding "text" adapter
ko.bindingHandlers.text = (function(textBinding) {
	return {
		/*init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			return textBinding.init.apply(this, arguments);
		},*/
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).text(
				i18n(
					ko.unwrap(valueAccessor())
				)
			);
		}
	};
})(ko.bindingHandlers.text);


/** Translate base (en)
 */
i18n.addLang('en', {
	':lang': 'English',

	"Carcass": "Framework",
	"Schema": "Scheme",
	
	"Level of detail, V": "Frequency, V",
	"Align the base": "Flat base",
	
	"else counter": "else anticlockwise",

	"Base radius, m": "Platform radius, m",
	"Base area, m2": "Platform area, m2",
	
	"Donate for Acidome": 'Donate for Acidome.Pro',
	
	"budget:": {
		"title:": {
			"line": "Edges",
			"face": "Faces",
			"vertex": "Vertices"
		}
	}
});


/** Translate extensions
 */
i18n.addLang('ru', {
	':lang': 'Русский',
	
	"//www.facebook.com/groups/acidome.calc/permalink/3170155026372549/"
		: "//www.facebook.com/groups/acidome.calc/permalink/3167952446592807/",

	"Carcass": "Каркас",
	"Schema": "Схема",
	"Cover": "Кровля",
	"Base": "План",

	"Figure options": "Исходная форма",
	
	"Polyhedron": "Многогранник",
	"Icosahedron": "Икосаэдр",
	"Octohedron": "Октаэдр",
	
	"Level of detail, V": "Частота, V",
	"Subdivision class": "Класс разбиения",
	"Subdivision method": "Метод разбиения",
	"method:": {
		"Equal Chords": 'Равные хорды',
		"Equal Arcs": 'Равные дуги',
		"Mexican": 'Мексиканец',
		"Kruschke": "Kruschke"
	},
	"Rotational symmetry": "Осевая симметрия",
	"Fullerene": "Фуллерен",
	"fulleren:": {
		"None": 'Нет',
		"Inscribed in": 'Вписанный',
		"Described around": 'Описанный'
	},
	"Part of full sphere": "Часть сферы",
	"Part of height": "По высоте",
	
	"Align the base": "Плоское основание",

	"Product options": "Продукция",
	"Sphere radius, m": "Радиус сферы, м",
	"Connection type": "Способ соединения",
	"Pipe diameter, mm": "Диаметр трубы, мм",
	"Spinning clockwise": "По-часовой",
	"else counter": "или против",

	"Timber size": "Материал ребер",
	"Width, mm": "Ширина, мм",
	"Thickness, mm": "Толщина, мм",

	"Resulting": "В результате",
	
	"Height from base, m": "Высота от основания, м",
	"Base radius, m": "Радиус основания, м",
	"Base area, m2": "Площадь основания, м2",
	"Base circle area, m2": "Площадь круга основания, м2",
	
	"Sizes (units)": "Типоразмеры (всего)",
	"Faces": "Граней",
	"Edges": "Ребер",
	"Vertices": "Вершин",
	
	"Beams": "Балки (ребра)",
	"Total length of beams, m": "Суммарная длина, м",
	"Total volume of beams, m3": "Объем ребер, м3",
	"Beam length, mm": "Длина ребра, мм",
	//"Max. beam length, mm": "Макс. длина ребра, мм",
	"Angle between faces, °": "Угол смежных граней, °",
	
	"Triangles": "Треугольники",
	"Polygons": "Многоугольники",
	"Coverage area, m2": "Площадь покрытия, м2",
	"Sum of perimeters, m": "Сумма периметров, м",
	
	"Min. height, mm": "Мин. высота, мм",
	"Max. side, mm": "Макс. сторона, mm",

	"mm": "мм",
	"pcs": "шт.",

	"buyme:": {
		"Product offering": "Предложения продукции",
		"Buy it": "Купить",
		"Sorry, error happens while we trying to order. Please, try again later.": 'К сожалению, при попытке заказать происходит ошибка. Пожалуйста, попробуйте повторить заказ позже.',
		"Thank you, the order has been successfully created.": 'Спасибо, заказ успешно создан. Проверьте вашу электронную почту.',
		"Check your email, if the letter is marked as spam, mark it as not spam.": 'Проверьте почту, если письмо случайно попало в папку "Спам", вытащите его оттуда.',
		"E-mail is not valid": "Вы ввели неправильный e-mail"
	},

	"share:": {
		"Share": 'Поделиться',
		"from acidome.com": 'от acidome.com'
	},

	"How to use calc": 'Как же этим пользоваться',
	"Facebook group": 'Группа Facebook',
	"Translate me": 'Переведи меня',
	
	"Acidome offline": 'Скачать Acidome',
	"Download frame .obj": 'Скачать каркас .obj',
	"Donate for Acidome": 'Donate for Acidome.Pro',

	"Please, wait...": "Ожидается...",
	"modified": 'изменен',

	"budget:": {
		"title:": {
			"line": "Ребра",
			"face": "Грани",
			"vertex": "Вершины"
		}
	},
	
	"door:": {
		"Door group": "Дверной проём",
		"Width, mm": "Ширина, мм",
		"Height, mm": "Высота, мм",
		"Direction, °": "Расположение, °",
	},

	"clothier:": {
		"Clothier": "Портной"
	}
});

/**
 * @thanks https://www.facebook.com/enrique.desanjulian
 */
i18n.addLang('es', {
	':lang': 'Español',
	
	"//www.facebook.com/groups/acidome.calc/permalink/3170155026372549/"
		: "//www.facebook.com/groups/acidome.calc/permalink/3169703449751040/",

	"Carcass": "Carcasa",
	"Schema": "Esquema",
	"Cover": "Cubierta",
	"Base": "Base",

	"Figure options": "Opciones de geometría",
	"Level of detail, V": "Frecuencia, V",
	"Subdivision class": "Tipo de subdivisión",
	"Subdivision method": "Método de subdivisión",
	"method:": {
		"Equal Chords": 'Cuerdas iguales',
		"Equal Arcs": 'Arcos iguales',
		"Mexican": 'Mexicano'
	},
	"Rotational symmetry": "Simetría rotacional",
	"Fullerene": "Circunscripción",
	"fulleren:": {
		"None": 'Ninguna',
		"Inscribed in": 'Inscrita dentro',
		"Described around": 'Descrita alrededor'
	},
	"Part of full sphere": "Porción de la esfera",
	"Align the base": "Alinear la base",

	"Product options": "Opciones de Proyecto",
	"Sphere radius, m": "Radio de la esfera, m",
	"Connection type": "Tipo de conexión",
	"Pipe diameter, mm": "Diámetro del tubo, mm",
	"Spinning clockwise": "Girando en sentido horario",
	"else counter": "sentido contrario",

	"Timber size": "Tamaño de las piezas",
	"Width, mm": "Anchura, mm",
	"Thickness, mm": "Grosor, mm",

	"Resulting": "Resultados",
	"Height from base, m": "Altura desde la base, m",
	"Base radius, m": "Radio de la base, m",
	"Sizes (units)": "Tamaños (unidades)",
	"Faces": "Caras",
	"Edges": "Aristas",
	"Vertices": "Vértices",
	"Beams": "Travesaños",
	"Total length of beams, m": "Longitud total de los travesaños, m",
	"Total volume of beams, m3": "Volumen total de los travesaños, m3",
	"Beam length, mm": "Longitud del travesaño, mm",
	"Max. beam length, mm": "Longitud máx. del travesaño, mm",
	"Angle between faces, °": "Ángulo entre caras, °",
	"Base area, m2": "Área de la base, m2",
	"Coverage area, m2": "Área de la cubierta, m2",
	"Triangles": "Triángulos",
	"Min. height, mm": "Altura mín., mm",
	"Max. side, mm": "Longitud máx. del lado, mm",

	"mm": "mm",
	"pcs": "piezas"
});

/**
 * @thanks https://www.facebook.com/bezruchko.arkadiy
 */
i18n.addLang('ua', {
	':lang': 'Українська',

	"Carcass": "Каркас",
	"Schema": "Схема",
	"Cover": "Покрівля",
	"Base": "План",

	"Figure options": "Вихідна форма",
	"Level of detail, V": "Частота, V",
	"Subdivision class": "Клас розбивки",
	"Subdivision method": "Метод розбивки",
	"method:": {
		"Equal Chords": 'Рівні хорди',
		"Equal Arcs": 'Рівні дуги',
		"Mexican": 'Мексиканський'
	},
	"Rotational symmetry": "Осьова симетрія",
	"Fullerene": "Фуллерен",
	"fulleren:": {
		"None": 'Немає',
		"Inscribed in": 'Вписаний',
		"Described around": 'Описаний'
	},
	"Part of full sphere": "Частина сфери",
	"Align the base": "Вирівнювати основу",

	"Product options": "Продукція",
	"Sphere radius, m": "Радіус сфери, м",
	"Connection type": "Спосіб з'єднаня",
	"Pipe diameter, mm": "Діаметр труби, мм",
	"Spinning clockwise": "За-годинниковою",
	"else counter": "або проти",

	"Timber size": "Матеріал ребер",
	"Width, mm": "Ширина, мм",
	"Thickness, mm": "Товщина, мм",

	"Resulting": "В результаті маємо",
	"Height from base, m": "Висота від основи, м",
	"Base radius, m": "Радіус основи, м",
	"Sizes (units)": "Разміри",
	"Faces": "Граней",
	"Edges": "Ребер",
	"Vertices": "Вершин",
	"Beams": "Балки (ребра)",
	"Total length of beams, m": "Сумарна довжина, м",
	"Total volume of beams, m3": "Об'єм ребер, м3",
	"Beam length, mm": "Довжина ребра, мм",
	"Max. beam length, mm": "Макс. довжина ребра, мм",
	"Angle between faces, °": "Кут суміжних граней, °",
	"Base area, m2": "Площа основи, м2",
	"Coverage area, m2": "Площа покриття, м2",
	"Triangles": "Трикутники",
	"Min. height, mm": "Мін. висота, мм",
	"Max. side, mm": "Макс. сторона, mm",

	"mm": "мм",
	"pcs": "шт."
});


/**
 * @thanks https://www.facebook.com/pascal.belzunce
 */
i18n.addLang('fr', {
	':lang': 'Français',

	"Carcass": "Squelette",
	"Schema": "Schéma",
	"Cover": "Couverture",
	"Base": "Sol",

	"Figure options": "Paramètres de la forme",
	"Level of detail, V": "Fréquence, V",
	"Subdivision class": "Classe de subdivision",
	"Subdivision method": "Méthode de subdivision",
	"method:": {
		"Equal Chords": 'Cordes égales',
		"Equal Arcs": 'Arcs égaux',
		"Mexican": 'Mexicaine'
	},
	"Rotational symmetry": "Axe de symétrie",
	"Fullerene": "Fullerène",
	"fulleren:": {
		"None": 'Aucune',
		"Inscribed in": 'Intérieur',
		"Described around": 'Extérieur'
	},
	"Part of full sphere": "Découpage de la sphère",
	"Align the base": "Aligner le bas",

	"Product options": "Caractéristiques du matériel",
	"Sphere radius, m": "Rayon de la sphère, m",
	"Connection type": "Type de connecteur",
	"Pipe diameter, mm": "Diamètre du tube, mm",
	"Spinning clockwise": "Sens horaire",
	"else counter": "antihoraire",

	"Timber size": "Taille des montants",
	"Width, mm": "Largeur, mm",
	"Thickness, mm": "Epaisseur, mm",

	"Resulting": "Résultats",
	"Height from base, m": "Hauteur au sol, m",
	"Base radius, m": "Rayon au sol, m",
	"Sizes (units)": "Quantités",
	"Faces": "Faces",
	"Edges": "Montants",
	"Vertices": "Nœuds",
	"Beams": "Montants",
	"Total length of beams, m": "Longueur totale des montants, м",
	"Total volume of beams, m3": "Volume total des montants, м3",
	"Beam length, mm": "Montant le plus, mm",
	"Max. beam length, mm": "Montant le plus grand, mm",
	"Angle between faces, °": "Angle entre les faces, °",
	"Base area, m2": "Surface au sol, m2",
	"Coverage area, m2": "Surface de la couverture, m2",
	"Triangles": "Triangles",
	"Min. height, mm": "Hauteur mini, mm",
	"Max. side, mm": "Côté maxi, mm",

	"mm": "mm",
	"pcs": "pcs",

	"Donate for Acidome": 'Donate for Acidome.Pro',

	"modified": 'modifié',

	"budget:": {
		"title:": {
			"line": "Montants",
			"face": "Faces",
			"vertex": "Nœuds"
		}
	}
});

/**
 * @thanks https://www.facebook.com/gencho.genchev.50
 */
i18n.addLang('bg', {
	':lang': 'Български',

	"Carcass": "Конструкция",
	"Schema": "Схема",
	"Cover": "Покрив",
	"Base": "Основа",

	"Figure options": "Изходна форма",
	"Level of detail, V": "Честота V",
	"Subdivision class": "Делови клас",
	"Subdivision method": "Метод на делене",
	"method:": {
		"Equal Chords": "Равни Хорди",
		"Equal Arcs": "Равни дъги",
		"Mexican": "Мексикански"
	},
	"Rotational symmetry": "Осева симетрия",
	"Fullerene": "Фулерен",
	"fulleren:": {
		"None": "Не",
		"Inscribed in": "Вписан",
		"Described around": "Описан"
	},
	"Part of full sphere": "Част от сферата",
	"Align the base": "Изравни на основата",

	"Product options": "Параметри на купола",
	"Sphere radius, m": "Радиус на сферата, м",
	"Connection type": "Тип връзки",
	"Pipe diameter, mm": "Диаметър на тръбата, мм",
	"Spinning clockwise": "По часовата стрелка",
	"else counter": "Обратно на ч.с.",

	"Timber size": "Материал на ребрата",
	"Width, mm": "Ширина, мм",
	"Thickness, mm": "Дебелина, мм",

	"Resulting": "Резултат",
	"Height from base, m": "Височина от основата, м",
	"Base radius, m": "Радиус на основата, м",
	"Sizes (units)": "Размери (бройки)",
	"Faces": "Многоъгълници",
	"Edges": "Греди",
	"Vertices": "Връзки",
	"Beams": "Греди",
	"Total length of beams, m": "Обща дължина греди, м",
	"Total volume of beams, m3": "Обем греди, м3",
	"Beam length, mm": "Дължина греда, мм",
	"Max. beam length, mm": "Максимална дължина греда, мм",
	"Angle between faces, °": "Ъгъл между съседни повърхности",
	"Base area, m2": "Площ на основата, м2",
	"Coverage area, m2": "Покривна площ, м2",
	"Triangles": "Триъгълници",
	"Min. height, mm": "Мин. Височина, мм",
	"Max. side, mm": "Минимална страна, мм",

	"mm": "мм",
	"pcs": "бр.",

    "budget:": {
        "title:": {
            "line": "Греди",
            "face": "Многоъгълници",
            "vertex": "Връзки"
        }
    }
});

i18n.addLang('pl', {
	':lang': 'Polski',

	"Carcass": "Konstrukcja",
	"Schema": "Schemat",
	"Cover": "Pokrycie",
	"Base": "Podstawa",

	"Figure options": "Opcje kształtu",
	"Level of detail, V": "Stopień aproksymacji, V",
	"Subdivision class": "Klasa podziału",
	"Subdivision method": "Metoda podziału",
	"method:": {
		"Equal Chords": 'Równych cięciw',
		"Equal Arcs": 'Równych łuków',
		"Mexican": 'Meksykańska'
	},
	"Rotational symmetry": "Оś symetrii",
	"Fullerene": "Wzór fulerenu",
	"fulleren:": {
		"None": 'Nie',
		"Inscribed in": 'Wpisany',
		"Described around": 'Opisany'
	},
	"Part of full sphere": "Część sfery",
	"Align the base": "Wyrównaj do podstawy",

	"Product options": "Opcje produktu",
	"Sphere radius, m": "Promień sfery, m",
	"Connection type": "Typ łączenia",
	"Pipe diameter, mm": "Średnica rury, mm",
	"Spinning clockwise": "Obrót w prawo ",
	"else counter": "lub w lewo",

	"Timber size": "Rozmiar belki",
	"Width, mm": "Szerokość, mm",
	"Thickness, mm": "Grubość, mm",

	"Resulting": "W wyniku otrzymujemy",
	"Height from base, m": "Wysokość od podstawy, m",
	"Base radius, m": "Promień podstawy, m",
	"Sizes (units)": "Elementy",
	"Faces": "Ścianki",
	"Edges": "Krawędzie",
	"Vertices": "Wierzchołki",
	"Beams": "Belki",
	"Total length of beams, m": "Całkowita długość belek, m",
	"Total volume of beams, m3": "Całkowita objętość belek, m3",
	"Beam length, mm": "Długość belki, mm",
	"Max. beam length, mm": "Maksymalna długość belki, mm",
	"Angle between faces, °": "Kąt pomiędzy ściankami, °",
	"Base area, m2": "Powierzchnia podstawy, m2",
	"Coverage area, m2": "Powierzchnia pokrycia, m2",
	"Triangles": "Тrójkąty",
	"Min. height, mm": "Maksymalna wysokość, mm",
	"Max. side, mm": "Maksymalna długość boku, mm",

	"mm": "mm",
	"pcs": "szt.",

	"budget:": {
		"title:": {
			"line": "Belki",
			"face": "Ścianki",
			"vertex": "Wierzchołki"
		}
	}
});

/**
 * @thanks Angelo Rebeli https://www.facebook.com/100009868328424
 */
i18n.addLang('gr', {
    ':lang': "Ελληνικά",
    "Carcass": "Πλαίσιο",
    "Schema": "Σχέδιο",
    "Cover": "Κάλυψη",
    "Base": "Σχέδιο Βάσης",
    "Figure options": " Επιλογές σχήματος ",
    "Level of detail, V": " Επίπεδο λεπτομέρειας, V",
    "Subdivision class": " Κλάση υποδιαίρεσης ",
    "Subdivision method": " Μέθοδος υποδιαίρεσης ",
    "method:": {
        "Equal Chords": ' Ίσες χορδές',
        "Equal Arcs": ' Ίσα τόξα ',
        "Mexican": ' Μεξικάνικη '
    },
    "Rotational symmetry": " Συμμετρία περιστροφής ",
    "Fullerene": " Fullerene ",
    "fulleren:": {
        "None": ' Όχι ',
        "Inscribed in": ' Εγγραφή σε ',
        "Described around": ' Περιγράφεται γύρω'
    },
    "Part of full sphere": " Μέρος της σφαίρας",
    "Align the base": " Ευθυγράμμιση της βάσης ",
    "Product options": " Επιλογές προϊόντος ",
    "Sphere radius, m": " Ακτίνα σφαίρας, м",
    "Connection type": " Μέθοδος σύνδεσης ",
    "Pipe diameter, mm": " Διάμετρος σωλήνα, mm",
    "Spinning clockwise": " Περιστροφή κατά τη φορά των δεικτών του ρολογιού ",
    "else counter": " Περιστροφή αντί τη φορά των δεικτών του ρολογιού ",
    "Timber size": " Διαστάσεις ξύλου ",
    "Width, mm": " Πλάτος, mm",
    "Thickness, mm": " Πάχος, mm",
    "Resulting": " Ως αποτέλεσμα έχουμε",
    "Height from base, m": " Ύψος από τη βάση, m",
    "Base radius, m": "Ακτίνα βάσης, m",
    "Sizes (units)": "Διαστάσεις ",
    "Faces": "Σύνορα",
    "Edges": "Ακόνες",
    "Vertices": " Κορυφές ",
    "Beams": " Δοκοί (νευρώσεις)",
    "Total length of beams, m": " Συνολικό μήκος δοκών, m",
    "Total volume of beams, m3": " Συνολικός όγκος δοκών, m3",
    "Beam length, mm": "Μέγιστο μήκος δέσμης, mm",
    "Max. beam length, mm": "Μέγιστο μήκος δέσμης, mm",
    "Angle between faces, °": "Γωνία μεταξύ γειτονικών προσώπων, °",
    "Base area, m2": "Εμβαδόν Βάσης, m2",
    "Coverage area, m2": "Εμβαδόν κάλυψης, m2",
    "Triangles": " Τρίγωνα ",
    "Min. height, mm": " Ελάχιστο ύψος, mm",
    "Max. side, mm": " Μέγιστη πλευρά, mm",
    "mm": "mm",
    "pcs": " τεμ."
});

/**
 * @thanks Hugo Hanssen https://www.facebook.com/groups/acidome.calc/?post_id=753359898052086&comment_id=2705936109461112
 */
i18n.addLang('nl', {
	':lang': 'Nederlands',
	
	"Carcass": "Skelet",
	"Schema": "Schema",
	"Cover": "Bedekking",
	"Base": "Basis",
	
	"Figure options": "Model opties",
	"Level of detail, V": "Aantal deelstukken, V",
	"Subdivision class": "Onderverdelings klasse",
	"Subdivision method": "Onderverdelings wijze",
	"method:": {
		"Equal Chords": 'Gelijke Staken',
		"Equal Arcs": 'Gelijke Hoeken',
		"Mexican": 'Меxicaans'
	},
	"Rotational symmetry": "Circulaire Symmetrie",
	"Fullerene": "Fullereen (Buckyball)",
	"fulleren:": {
		"None": 'Geen',
		"Inscribed in": 'Ingeschreven',
		"Described around": 'Omschreven'
	},
	"Part of full sphere": "Deel van hele bol",
	"Align the base": "De basis uitvlakken",
	
	"Product options": "Product Opties",
	"Sphere radius, m": "Straal van de bol, м",
	"Connection type": "Verbindings type",
	"Pipe diameter, mm": "Buis diameter, мм",
	"Spinning clockwise": "Draait kloksgewijs",
	"else counter": "Anders draaiend",
	
	"Timber size": "Balkmaat",
	"Width, mm": "Breedte, мм",
	"Thickness, mm": "Dikte, mm",
	
	"Resulting": "Resultaat",
	"Height from base, m": "Hoogte vanaf de basis, m",
	"Base radius, m": "Straal van de basis, m",
	"Sizes (units)": "Maten (eenheden)",
	"Faces": "Vlakken",
	"Edges": "Randen",
	"Vertices": "Hoekpunten",
	"Beams": "Balken (Ribben)",
	"Total length of beams, m": "Lengte van de balken, m",
	"Total volume of beams, m3": "Volume van de balken, m3",
	"Beam length, mm": "Balklengte, mm",
	"Max. beam length, mm": "Max. balklengte, mm",
	"Angle between faces, °": "oek tussen de vlakken, °",
	"Base area, m2": "Oppervlak van de basis, m2",
	"Coverage area, m2": "Bestrijkingsgebied, m2",
	
	"Triangles": "Driehoeken",
	"Min. height, mm": "Min. Hoogte, mm",
	"Max. side, mm": "Max. breedte, mm",
	"mm": "mm",
	"pcs": "stuks.",
});

/**
 * @thanks Gerhard Bicker https://www.facebook.com/groups/acidome.calc/?post_id=753359898052086&comment_id=2860008697387185
 */
i18n.addLang('de', {
	':lang': 'Deutsch',
	
	"Carcass": "Rahmen",
	"Schema": "Schema",
	"Cover": "Abdeckung",
	"Base": "Grundfläche",
	"Tent": "Bedruckung",
	
	"Figure options": "Berechnungsoptionen",
	
	"Polyhedron": "Polyeder",
	"Icosahedron": "Ikosaeder",
	"Octohedron": "Oktaeder",

	"Level of detail, V": "Frequenz (Detaillevel)",
	"Subdivision class": "Unterteilungsklasse",
	"Subdivision method": "Unterteilungsmethode",
	"method:": {
		"Equal Chords": 'gleiche Abstände',
		"Equal Arcs": 'gleiche Winkel',
		"Mexican": 'mexikanisch'
	},
	"Rotational symmetry": "Rotationssymetrie",
	"symmetry:": { // not used
		"Pentad": "5-fach",
		"Cross": "4-fach",
		"Triad": "3-fach"
	},
	"Fullerene": "Fullerene",
	"fulleren:": {
		"None": 'nein',
		"Inscribed in": 'einbeschrieben',
		"Described around": 'umbeschrieben'
	},
	"Part of full sphere": "Teil einer vollen Kugel",
	"Align the base": "Standfläche anpassen",
	
	"Product options": "Produktoptionen",
	"Sphere radius, m": "Kugelradius, m",
	"Connection type": "Verbindungstyp",
	"connection:": { // not used
		"Piped": "Rohr",
		"GoodKarma": "Stoß, Rahmenbauweise",
		"Semicone": "Spitz zulaufend, Rahmenbauweise",
		"Cone": "Spitz zulaufend",
		"Joint": "Stoß"
	},
	"Pipe diameter, mm": "Rohrdurchmesser, mm",
	"Spinning clockwise": "im Uhrzeigersinn gedreht",
	"else counter": "sonst dagegen",
	
	"Timber size": "Balken Abmessungen",
	"Width, mm": "Breite, mm",
	"Thickness, mm": "Stärke, mm",
	
	"Resulting": "Zusammenfassung",
	"Height from base, m": "Höhe von der Grundfläche, m",
	"Base radius, m": "Radius Grundfläche, m",
	"Sizes (units)": "verschiedene Größen (Gesamtanzahl)",
	"Faces": "Flächen",
	"Edges": "Kanten",
	"Vertices": "Eckpunkte",
	"Beams": "Balken",
	"Total length of beams, m": "Gesamtlänge der Balken, m",
	"Total volume of beams, m3": "Gesamtvolumen der Balken, m³",
	"Beam length, mm": "Balkenlänge, mm",
	"Max. beam length, mm": "Maximale Balkenlänge, mm",
	"Angle between faces, °": "Winkel zwischen Flächen, °",
	"Base area, m2": "Grundfläche, m²",
	"Coverage area, m2": "Oberfläche, m²",
	
	"Triangles": "Dreiecke",
	"Min. height, mm": "kleinste Höhen, mm",
	"Max. side, mm": "längste Seiten, mm",
	"mm": "mm",
	"pcs": "Stk.",

	"budget:": {
		"title:": {
			"line": "Balken",
			"face": "Flächen",
			"vertex": "Eckpunkte"
		}
	}
});

/**
 * @thanks Ionut Claudiu Baciu https://www.facebook.com/groups/acidome.calc/?post_id=753359898052086&comment_id=3012539525467434
 */
i18n.addLang('ro', {
	":lang": "Română",

	"Carcass": "Cadru",
	"Schema": "Schemă",
	"Cover": "Acoperire",
	"Base": "Bază",

	"Figure options": "Obțiuni de construcție",
	"Polyhedron": "Poliedru",
	"Icosahedron": "Icosahedron",
	"Octohedron": "Octaedru",
	"Level of detail, V": "Acuratețe formă, V",
	"Subdivision class": "Clasă de subdiviziune",
	"Subdivision method": "Metodă de divizare",

	"method:": {
		"Equal Chords": "Laturi egale",
		"Equal Arcs": "Unghiuri egale",
		"Mexican": "Mexican",
		"Kruschke": "Kruschke"
	},
	"Rotational symmetry": "Simetrie de rotație",
	"Fullerene": "Poziție laturi construcție",
	"fulleren:": {
		"None": "Nimic",
		"Inscribed in": "interiorul Sferei",
		"Described around": "exteriorul Sferei"
	},
	"Part of full sphere": "Parte din sferă",
	"Part of height": "Parte din înălțime",
	"Align the base": "Bază plată",

	"Product options": "Dimensiuni sferă",
	"Sphere radius, m": "Raza Sferei, m",
	"Connection type": "Tip de îmbinare",
	"Pipe diameter, mm": "Diametru țeavă îmbinare",
	"Spinning clockwise": "Sens orar",
	"else counter": "Sens antiorar",
	"Timber size": "Dimensiune cherestea",
	"Width, mm": "Lățime, mm",
	"Thickness, mm": "Grosime,mm",

	"Resulting": "Dimensiuni calcul Sferă",
	"Height from base, m": "Înaltimea sferei de la bază, m",
	"Base radius, m": "Raza bazei Sferei, m",
	"Sizes (units)": "Cantități",
	"Faces": "Nr. fețe",
	"Edges": "Nr. Grinzi",
	"Vertices": "nr. piese verticale",
	"Beams": "Grindă",
	"Total length of beams, m": "Lungimea totală a grindei, m",
	"Total volume of beams, m3": "Volumul total al grindei, m3",
	"Beam length, mm": "Lungimea a unei grinzi, mm",
	"Max. beam length, mm": "Lungimea max. a unei grinzi, mm",
	"Angle between faces, °": "Unghi îmbinare fețe, °",
	"Base area, m2": "Suprafață bază sferă, m2",
	"Coverage area, m2": "Suprafață de acoperit, m2",
	"Triangles": "Triunghiuri",
	"Min. height, mm": "Înălțime min., mm",
	"Max. side, mm": "Lungime max. latură, mm",

	"mm": "mm",
	"pcs": "buc.",

	"buyme:": {
		"Product offering": "Ofertă de produse",
		"Buy it": "Cumpără",
		"Sorry, error happens while we trying to order. Please, try again later.": "Ne pare rău,timp ce încercam să comandăm a apărut o eruare. Vă rugăm să încercați din nou mai târziu.",
		"Thank you, the order has been successfully created.": "Vă mulțumim, comanda a fost plasată cu succes.",
		"Check your email, if the letter is marked as spam, mark it as not spam.": "Verificați e-mailul dvs., dacă este marcat ca spam, marcați-l ca non spam.",
		"E-mail is not valid": "E-mail nu este valid"
	},
	"share:": {
		"Share": "Împărtășește",
		"from acidome.ru": "de la acidome.ru"
	},
	"How to use calc": "Cum se utilizează calc",
	"Facebook group": "Grup Facebook",
	"Translate me": "Traduce-mă",
	"Acidome offline": "Acidome offline",
	"Download frame .obj": "Descarcă piesa.obj 3D",
	"Donate for Acidome": "Donează pentru Acidome.Pro",
	"modified": "Modifică",
	"budget:": {
		"title:": {
			"line": "Linie",
			"face": "Fațete",
			"vertex": "Zenit"
		}
	},
	"clothier:": {
		"Clothier": "Croitor"
	}
});
