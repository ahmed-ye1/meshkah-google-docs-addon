function onOpen() {
  DocumentApp.getUi().createMenu('مِشكاة')
    .addItem('فتح مِشكاة', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('مِشكاة')
    .setWidth(300);
  DocumentApp.getUi().showSidebar(html);
}

function getSettings() {
  var props = PropertiesService.getUserProperties().getProperties();
  return {
    quranColor: props.quranColor || '#000000',
    hadithColor: props.hadithColor || '#000000',
    sharhColor: props.sharhColor || '#333333',
    tafsirColor: props.tafsirColor || '#2980b9',
    turathColor: props.turathColor || '#2c3e50',
    quranSourceColor: props.quranSourceColor || '#7f8c8d',
    hadithSourceColor: props.hadithSourceColor || '#7f8c8d',
    turathSourceColor: props.turathSourceColor || '#7f8c8d',
    fontFamily: props.fontFamily || 'Arial',
    fontSize: props.fontSize || '14',
    quranSourcePos: props.quranSourcePos || 'inline', 
    hadithSourcePos: props.hadithSourcePos || 'inline',
    turathLinkToggle: props.turathLinkToggle === 'true',
    hadithLinkToggle: props.hadithLinkToggle === 'true',
    quranLinkToggle: props.quranLinkToggle === 'true',
    hadithApiKey: props.hadithApiKey || ''
  };
}

function saveSettings(settings) {
  PropertiesService.getUserProperties().setProperties(settings);
  return true;
}

// ------- دوال القرآن -------
function searchQuranByText(query) {
  var url = "http://api.alquran.cloud/v1/search/" + encodeURIComponent(query) + "/all/quran-simple";
  var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  if(res.getResponseCode() === 200) {
    var matches = JSON.parse(res.getContentText()).data.matches;
    
    matches.forEach(function(match) {
      if (match.surah.number != 1 && match.numberInSurah === 1) {
        match.text = match.text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '').replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, '');
      }
    });
    
    return matches;
  }
  return [];
}

function getQuranRange(surahNum, from, to) {
  var verses = [];
  for (var i = from; i <= to; i++) {
    var url = "http://api.alquran.cloud/v1/ayah/" + surahNum + ":" + i + "/quran-simple";
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if(res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText()).data;
      
      if (surahNum != 1 && data.numberInSurah === 1) {
         data.text = data.text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '').replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, '');
      }
      
      verses.push({ text: data.text, numberInSurah: data.numberInSurah, surahName: data.surah.name });
    }
  }
  return verses;
}

// ------- دالة جلب القرآن والتفسير/الترجمة لنطاق محدد -------
function getQuranAndTafsirRange(surahId, from, to, tafsirId, tafsirName) {
  var urlQuran = "http://api.alquran.cloud/v1/surah/" + surahId + "/quran-uthmani";
  
  try {
    var resQ = UrlFetchApp.fetch(urlQuran, {muteHttpExceptions: true});
    var dataQ = JSON.parse(resQ.getContentText());
    if (dataQ.code !== 200) return { error: "خطأ في جلب السورة" };
    
    var ayahs = dataQ.data.ayahs.slice(from - 1, to);
    
    ayahs.forEach(function(ayah) {
      if (surahId != 1 && ayah.numberInSurah === 1) {
        ayah.text = ayah.text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '').replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, '');
      }
    });
    
    var tafsirAyahs = [];
    
    if (tafsirId !== 'none') {
      if (tafsirId === 'sahih-int') {
        var enUrl = "http://api.alquran.cloud/v1/surah/" + surahId + "/en.sahih";
        var resEn = UrlFetchApp.fetch(enUrl, {muteHttpExceptions: true});
        if (resEn.getResponseCode() === 200) {
          var enData = JSON.parse(resEn.getContentText());
          if (enData.code === 200) {
            var enAyahs = enData.data.ayahs.slice(from - 1, to);
            enAyahs.forEach(function(ea, idx) {
              tafsirAyahs.push({ numberInSurah: from + idx, text: ea.text });
            });
          }
        }
        tafsirName = "Sahih International";
      } else if (tafsirId === 'saadi') {
        // توجيه السعدي إلى واجهة Quran.com API الآمنة
        var reqs = [];
        for (var i = from; i <= to; i++) {
           var saadiUrl = "https://api.quran.com/api/v4/tafsirs/91/by_ayah/" + surahId + ":" + i;
           reqs.push({ url: saadiUrl, muteHttpExceptions: true });
        }
        
        var resTafsirs = UrlFetchApp.fetchAll(reqs);
        for (var j = 0; j < resTafsirs.length; j++) {
          if (resTafsirs[j].getResponseCode() === 200) {
            var tData = JSON.parse(resTafsirs[j].getContentText());
            if (tData && tData.tafsir && tData.tafsir.text) {
               var cleanText = tData.tafsir.text.replace(/<[^>]+>/g, '').trim();
               tafsirAyahs.push({ numberInSurah: from + j, text: cleanText });
            }
          }
        }
        tafsirName = "تفسير السعدي";
      } else {
        // باقي التفاسير العربية من quran-tafseer
        var reqs = [];
        for (var i = from; i <= to; i++) {
           var tafsirUrl = "http://api.quran-tafseer.com/tafseer/" + tafsirId + "/" + surahId + "/" + i;
           reqs.push({ url: tafsirUrl, muteHttpExceptions: true });
        }
        
        var resTafsirs = UrlFetchApp.fetchAll(reqs);
        for (var j = 0; j < resTafsirs.length; j++) {
          if (resTafsirs[j].getResponseCode() === 200) {
            var tData = JSON.parse(resTafsirs[j].getContentText());
            if (tData && tData.text) {
               var cleanText = tData.text.replace(/<[^>]+>/g, '').trim();
               tafsirAyahs.push({ numberInSurah: from + j, text: cleanText });
            }
          }
        }
      }
    }
    
    return {
      surahName: dataQ.data.name,
      ayahs: ayahs,
      tafsirs: tafsirAyahs,
      tafsirName: tafsirName
    };
  } catch(e) {
    return { error: "فشل الاتصال بالخادم: " + e.toString() };
  }
}

// ------- دوال الحديث (HadithAPI) -------
function searchHadithAPI(query, bookSlug, apiKey) {
  if (!apiKey) return { error: "يرجى إضافة مفتاح API في الإعدادات." };
  var url = "https://hadithapi.com/api/hadiths?apiKey=" + apiKey.trim() + "&hadithArabic=" + encodeURIComponent(query) + "&paginate=50";
  
  if (bookSlug && bookSlug !== 'all') {
    url += "&book=" + encodeURIComponent(bookSlug);
  }
  
  return fetchHadithData(url);
}

function getHadithByNumberAPI(bookSlug, hadithNum, apiKey) {
  if (!apiKey) return { error: "يرجى إضافة مفتاح API في الإعدادات." };
  var url = "https://hadithapi.com/api/hadiths?apiKey=" + apiKey.trim() + "&book=" + encodeURIComponent(bookSlug) + "&hadithNumber=" + encodeURIComponent(hadithNum);
  return fetchHadithData(url);
}

function fetchHadithData(url) {
  try {
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var code = res.getResponseCode();
    if (code === 200) {
      return JSON.parse(res.getContentText());
    } else if (code === 401) {
      return { error: "مفتاح API غير صالح. تأكد من نسخه بشكل صحيح." };
    } else if (code === 403) {
      return { error: "مفتاح API مطلوب للبحث." };
    } else if (code === 404) {
      return { error: "لا توجد نتائج مطابقة. جرب البحث بنص من الحديث." };
    } else {
      return { error: "خطأ في الخادم (الكود: " + code + ")" };
    }
  } catch (e) {
    return { error: "فشل الاتصال: " + e.toString() };
  }
}

// ------- دالة الإدراج الذكية (توجيه ومحاذاة تحترم تنسيق المستخدم) -------
function insertContent(payload) {
  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();
  if (!cursor) throw new Error('الرجاء وضع مؤشر الفأرة في المكان المراد الإدراج فيه.');

  var settings = getSettings();
  var sourcePos = payload.type === 'quran' ? settings.quranSourcePos : settings.hadithSourcePos;
  if (sourcePos === 'footnote') { sourcePos = 'inline'; }

  var textPart = payload.text.trim().replace(/[\s\.،]+$/, ''); 
  var sourcePart = "";
  var fullText = "";

  if (payload.type === 'sharh' || payload.type === 'tafsir' || payload.type === 'turath') {
    sourcePart = payload.source ? "\n[" + payload.source + "]" : "";
    fullText = textPart + sourcePart + " ";
  } else {
    sourcePart = (sourcePos === 'inline' && payload.source) ? ". [" + payload.source + "]" : ".";
    fullText = textPart + sourcePart + " "; 
  }
  
  // الحصول على الفقرة الأصلية قبل الإدراج
  var startElement = cursor.getElement();
  var startPara = startElement;
  while (startPara && startPara.getType() !== DocumentApp.ElementType.PARAGRAPH && startPara.getType() !== DocumentApp.ElementType.LIST_ITEM) {
    startPara = startPara.getParent();
  }
  
  var insertedElement = cursor.insertText(fullText);
  
  // --- فحص دقيق للغة: إذا لم يحتوِ النص على أي حرف عربي، فهو إنجليزي ---
  var isEnglish = !(/[\u0600-\u06FF]/.test(textPart));
  
  // --- تطبيق الاتجاه والمحاذاة بذكاء ---
  var newlinesCount = (fullText.match(/\n/g) || []).length;
  var currentPara = startPara;
  
  for (var i = 0; i <= newlinesCount; i++) {
    if (currentPara && (currentPara.getType() === DocumentApp.ElementType.PARAGRAPH || currentPara.getType() === DocumentApp.ElementType.LIST_ITEM)) {
      
      if (isEnglish) {
        // إذا كان إنجليزياً: افرض الاتجاه لليسار والمحاذاة لليسار
        currentPara.setLeftToRight(true);
        currentPara.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
      } else {
        // إذا كان عربياً: لا تتدخل أبداً إلا إذا كانت الفقرة يسارية (ورثتها من نص إنجليزي سابق)
        if (currentPara.isLeftToRight() !== false) {
          currentPara.setLeftToRight(false);
          currentPara.setAlignment(null); // ترك المحاذاة للقيمة الافتراضية الطبيعية للـ RTL
        }
      }
      
    }
    if (i < newlinesCount && currentPara) {
      currentPara = currentPara.getNextSibling();
    }
  }

  // --- إعداد الألوان والخطوط ---
  var mainColorMap = {
    quran: settings.quranColor,
    sharh: settings.sharhColor,
    tafsir: settings.tafsirColor,
    turath: settings.turathColor
  };
  var mainStyle = {};
  mainStyle[DocumentApp.Attribute.FONT_FAMILY] = settings.fontFamily;
  mainStyle[DocumentApp.Attribute.FONT_SIZE] = parseInt(settings.fontSize);
  mainStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = mainColorMap[payload.type] || settings.hadithColor;
  insertedElement.setAttributes(mainStyle);

  // --- لون التوثيق: تم حذف شرط newlinesCount === 0 الذي كان يمنع تلوين
  //     التوثيق كلما وضعناه في سطر جديد (حال الشرح والتفسير وتراث دائمًا) ---
  if (sourcePart !== "" && sourcePart !== ".") {
    var srcColorMap = {
      quran: settings.quranSourceColor,
      tafsir: settings.quranSourceColor, // يتبع لون توثيق القرآن؛ أضف tafsirSourceColor مستقلاً لاحقًا إن أردت فصله
      sharh: settings.hadithSourceColor,
      turath: settings.turathSourceColor
    };
    var sourceStyle = {};
    sourceStyle[DocumentApp.Attribute.FONT_FAMILY] = settings.fontFamily;
    sourceStyle[DocumentApp.Attribute.FONT_SIZE] = parseInt(settings.fontSize);
    sourceStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = srcColorMap[payload.type] || settings.hadithSourceColor;
    try {
      var startOffset = textPart.length; 
      var endOffset = startOffset + sourcePart.length - 1; 
      insertedElement.setAttributes(startOffset, endOffset, sourceStyle);

      // توثيق تشعيبي اختياري: يعمل فقط إذا فُعّل التبديل لهذا النوع ووُجد رابط فعلي
      var linkToggleMap = { quran: settings.quranLinkToggle, hadith: settings.hadithLinkToggle, turath: settings.turathLinkToggle };
      if (linkToggleMap[payload.type] && payload.sourceUrl) {
        insertedElement.setLinkUrl(startOffset, endOffset, payload.sourceUrl);
      }
    } catch(e) {}
  }
  
  return true;
}

// ------- توثيق نص محدد بالفعل في مستند المستخدم (مكتبة تراث) -------

// يقرأ النص الذي حدّده المستخدم في مستنده (وليس في صندوق الشريط الجانبي)
function getDocSelectionText() {
  var doc = DocumentApp.getActiveDocument();
  var sel = doc.getSelection();
  if (!sel) return { error: 'حدد نصًا في المستند أولاً، ثم اضغط الزر مرة أخرى.' };

  var parts = [];
  sel.getRangeElements().forEach(function (re) {
    var el = re.getElement();
    if (!el.editAsText) return;
    var full = el.asText().getText();
    if (re.isPartial()) {
      parts.push(full.substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1));
    } else {
      parts.push(full);
    }
  });

  var text = parts.join(' ').trim();
  if (!text) return { error: 'لم أستطع قراءة نص محدد. حاول تحديده مرة أخرى.' };
  return { text: text };
}

// بحث في تراث بنص كامل (لا عنوان كتاب) — يُستخدم لتوثيق نص المستند.
// شكل رد /search غير مؤكد بالكامل حتى تجربته على رد حقيقي، فالحقول
// أدناه قد تحتاج تعديلاً.
function searchTurathText(query, limit) {
  var url = "https://api.turath.io/search?q=" + encodeURIComponent(query) + "&ver=3";
  try {
    var res = UrlFetchApp.fetch(url, { headers: { Accept: "application/json" }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      return { error: "تعذر البحث في تراث (الكود: " + res.getResponseCode() + ")." };
    }
    var data = JSON.parse(res.getContentText());
    var raw = data.data || [];
    if (!raw.length) return { error: "لم يُعثر على هذا النص في مكتبة تراث." };

    var items = raw.slice(0, limit || 8).map(function (r) {
      var meta = r.meta;
      try { if (typeof meta === 'string') meta = JSON.parse(meta); } catch (e) { meta = {}; }
      meta = meta || {};
      return {
        bookId: r.book_id,
        bookName: meta.book_name || '',
        authorName: meta.author_name || '',
        vol: meta.vol || '',
        page: meta.page || '',
        snippet: String(r.snip || r.text || '').replace(/<[^>]+>/g, '').trim().slice(0, 200)
      };
    });
    return { items: items };
  } catch (e) {
    return { error: "فشل الاتصال: " + e };
  }
}

// يُدرج التوثيق مباشرة بعد النص الذي حدّده المستخدم في مستنده
// (بدل إعادة كتابة النص كله). يعمل بثقة مع تحديد داخل فقرة واحدة؛
// تحديد يمتد عبر عدة فقرات حالة أعقد لم تُعالج هنا.
function insertCitationAfterSelection(sourceText, turathUrl) {
  var doc = DocumentApp.getActiveDocument();
  var sel = doc.getSelection();
  if (!sel) throw new Error('حدد النص في المستند أولاً.');

  var elems = sel.getRangeElements();
  var last = elems[elems.length - 1];
  var el = last.getElement();
  if (!el.editAsText) throw new Error('تعذر تحديد نهاية النص المحدد.');
  var textEl = el.asText();
  var insertPos = last.isPartial() ? last.getEndOffsetInclusive() + 1 : textEl.getText().length;

  var settings = getSettings();
  var bracket = ' [' + sourceText + ']';
  textEl.insertText(insertPos, bracket);

  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = settings.fontFamily;
  style[DocumentApp.Attribute.FONT_SIZE] = parseInt(settings.fontSize);
  style[DocumentApp.Attribute.FOREGROUND_COLOR] = settings.turathSourceColor;
  
  try { 
    textEl.setAttributes(insertPos, insertPos + bracket.length - 1, style); 
    // تفعيل الرابط التشعيبي إذا كان مفعلًا في الإعدادات
    if (settings.turathLinkToggle && turathUrl) {
      textEl.setLinkUrl(insertPos, insertPos + bracket.length - 1, turathUrl);
    }
  } catch (e) {}

  return true;
}

// ------- دالة البحث النصي عبر خادم الدرر السنية الوسيط (Vercel) -------
function searchHadithTextDorarAPI(query) {
  var DORAR_HOST = "https://dorar-hadith-api-omega.vercel.app"; 
  var url = DORAR_HOST + "/v1/site/hadith/search?value=" + encodeURIComponent(query) + "&removehtml=true";
  
  try {
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var code = res.getResponseCode();
    
    if (code === 200) {
      var dorarRes = JSON.parse(res.getContentText());
      var normalizedData = [];
      if (dorarRes.data && dorarRes.data.length > 0) {
        normalizedData = dorarRes.data.map(function(item) {
          return {
            isDorar: true,
            hadithArabic: item.hadith,
            bookName: item.book, 
            hadithNumber: item.numberOrPage,
            grade: item.grade,
            mohdith: item.mohdith,
            takhrij: item.takhrij || "",
            hasSharh: item.hasSharhMetadata || false,
            sharhId: (item.sharhMetadata && item.sharhMetadata.id) ? item.sharhMetadata.id : null
          };
        });
      } else {
        return { error: "لا توجد نتائج مطابقة في الدرر السنية." };
      }
      return { hadiths: { data: normalizedData } };
    } else {
      return { error: "خطأ في محرك البحث (الكود: " + code + ")" };
    }
  } catch (e) {
    return { error: "فشل الاتصال بالخادم الوسيط: " + e.toString() };
  }
}

// ------- دالة جلب الشرح الفردي من الدرر السنية -------
function fetchSharhAPI(sharhId) {
  var DORAR_HOST = "https://dorar-hadith-api-omega.vercel.app";
  var url = DORAR_HOST + "/v1/site/sharh/" + sharhId;
  
  try {
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText());
      if (data.data && data.data.sharhMetadata && data.data.sharhMetadata.sharh) {
        return { sharh: data.data.sharhMetadata.sharh };
      }
    }
    return { error: "عذراً، تعذر سحب نص الشرح لهذا الحديث." };
  } catch (e) {
    return { error: "فشل الاتصال بالخادم لجلب الشرح: " + e.toString() };
  }
}

// ------- جلب حديث بالإنجليزية للبحث النصي بناءً على الكتاب ورقم الحديث -------
function fetchEnglishHadithByBookAndNum(bookNameArabic, hadithNum, apiKey) {
  if (!apiKey) return { error: "مفتاح HadithAPI مطلوب لجلب الترجمة الإنجليزية." };
  
  var bookSlugMap = {
    "صحيح البخاري": "sahih-bukhari",
    "صحيح مسلم": "sahih-muslim",
    "جامع الترمذي": "al-tirmidhi",
    "سنن أبي داود": "abu-dawood",
    "سنن النسائي": "sunan-nasai",
    "سنن ابن ماجه": "ibn-e-majah",
    "مشكاة المصابيح": "mishkat"
  };
  
  var bookSlug = bookSlugMap[bookNameArabic.trim()];
  if (!bookSlug) return { error: "هذا الكتاب غير متوفر بالإنجليزية." };
  
  var url = "https://hadithapi.com/api/hadiths?apiKey=" + apiKey.trim() + "&book=" + bookSlug + "&hadithNumber=" + encodeURIComponent(hadithNum);
  
  try {
    var res = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText());
      if (data.hadiths && data.hadiths.data && data.hadiths.data.length > 0) {
        var h = data.hadiths.data[0];
        return {
          englishText: h.hadithEnglish || "النص الإنجليزي غير متوفر.",
          englishBook: h.book ? h.book.bookName : bookNameArabic,
          englishNumber: h.hadithNumber || hadithNum
        };
      }
    }
    return { error: "لم يتم العثور على الحديث بالإنجليزية في المصدر." };
  } catch (e) {
    return { error: "فشل الاتصال: " + e.toString() };
  }
}

// ------- دوال مكتبة تراث (Turath API) -------
function fetchTurathPageAPI(bookId, pg) {
  var url = "https://api.turath.io/page?book_id=" + bookId + "&pg=" + pg + "&ver=3";
  try {
    var res = UrlFetchApp.fetch(url, {
      headers: { Accept: "application/json" },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText());
      var meta = typeof data.meta === 'string' ? JSON.parse(data.meta) : data.meta;
      return {
        text: data.text || "",
        meta: meta
      };
    }
    return { error: "تعذر جلب الصفحة من خادم تراث." };
  } catch (e) {
    return { error: "فشل الاتصال: " + e.toString() };
  }
}