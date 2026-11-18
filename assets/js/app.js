(function () {
  "use strict";

  var CONFIG = window.LH_CONFIG || {};
  var STRINGS = window.LH_I18N;
  var LANGS = { en: "EN", ru: "RU", hy: "AM" };
  var STORAGE_KEY = "lh-language";
  var language = "en";

  // Weight classes as agreed in Figma. Sent to the organisers as "-60 kg", whatever the page language.
  var WEIGHTS = {
    male: ["−60", "−65", "−70", "−76", "−83", "−91", "−100", "+100"],
    female: ["−50", "−55", "−60", "−65", "−70", "+70"],
  };

  function t(key) {
    return STRINGS[language][key];
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  // ---------- Language ----------

  function readSavedLanguage() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function saveLanguage(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* The choice just won't be remembered. */
    }
  }

  function applyLanguage(value) {
    language = STRINGS[value] ? value : "en";
    document.documentElement.lang = language;
    document.title = t($("#signup") ? "pageForm" : "pageInfo");

    $$("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
    $$("[data-i18n-ph]").forEach(function (node) {
      node.placeholder = t(node.dataset.i18nPh);
    });
    $$("[data-i18n-aria]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });

    var current = $("[data-lang-current]");
    if (current) current.textContent = LANGS[language];
    $$("[data-lang-option]").forEach(function (option) {
      var active = option.dataset.langOption === language;
      option.setAttribute("aria-current", active ? "true" : "false");
    });

    document.dispatchEvent(new CustomEvent("lh:language"));
  }

  function setupLanguageMenu() {
    var toggle = $("[data-lang-toggle]");
    var panel = $("[data-lang-panel]");
    if (!toggle || !panel) return;

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", function () {
      setOpen(panel.hidden);
    });

    $$("[data-lang-option]", panel).forEach(function (option) {
      option.addEventListener("click", function () {
        saveLanguage(option.dataset.langOption);
        applyLanguage(option.dataset.langOption);
        setOpen(false);
        toggle.focus();
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-lang]")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ---------- Pages and menu ----------

  // Switching page swaps the content and leaves the menu on screen, so the pill can
  // finish its bounce. Each page is kept once loaded, so details typed into the form
  // survive a trip to Info and back. If anything fails, the link just loads normally.

  function pageKey(url) {
    var path = new URL(url, window.location.href).pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
    return path || "/";
  }

  function setupNavigation() {
    var menu = $(".menu");
    var pill = $("[data-menu-pill]");
    var items = $$(".menu__item", menu);
    var pages = {};
    var addresses = {};
    var loading = {};
    var currentKey = pageKey(window.location.href);
    var latest = 0;

    pages[currentKey] = { main: $("main"), ready: true };
    addresses[currentKey] = window.location.pathname;

    function itemFor(key) {
      return items.filter(function (item) {
        return pageKey(item.href) === key;
      })[0];
    }

    function isOurPage(url) {
      return Boolean(itemFor(pageKey(url)));
    }

    function moveTo(item, instant) {
      var x = item.offsetLeft + "px";
      var width = item.offsetWidth + "px";
      // Re-placing the pill at the same spot must not cancel a bounce in progress.
      if (pill.style.getPropertyValue("--pill-x") === x && pill.style.getPropertyValue("--pill-width") === width) return;
      if (instant) pill.classList.add("no-motion");
      pill.style.setProperty("--pill-x", x);
      pill.style.setProperty("--pill-width", width);
      if (instant) {
        void pill.offsetWidth;
        pill.classList.remove("no-motion");
      }
    }

    function settle() {
      var current = itemFor(currentKey) || items[0];
      moveTo(current, true);
    }

    function load(key, url) {
      if (pages[key]) return Promise.resolve(pages[key]);
      if (loading[key]) return loading[key];
      loading[key] = fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error("Status " + response.status);
          addresses[key] = new URL(response.url).pathname;
          return response.text();
        })
        .then(function (html) {
          var main = new DOMParser().parseFromString(html, "text/html").querySelector("main");
          if (!main) throw new Error("No content");
          pages[key] = { main: document.importNode(main, true), ready: false };
          return pages[key];
        })
        .catch(function (error) {
          delete loading[key];
          throw error;
        });
      return loading[key];
    }

    function scrollFor(hash) {
      var target = hash && document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    }

    function goTo(url, addToHistory) {
      var link = new URL(url, window.location.href);
      var key = pageKey(link.href);
      var fromKey = currentKey;
      var request = ++latest;

      if (key === currentKey) {
        if (addToHistory && link.hash) window.history.pushState(null, "", link.hash);
        scrollFor(link.hash);
        return;
      }

      // The pill moves straight away, whether or not the content has arrived.
      items.forEach(function (item) {
        if (pageKey(item.href) === key) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
      moveTo(itemFor(key));

      load(key, link.href)
        .then(function (page) {
          if (request !== latest) return; // Someone has already clicked somewhere else.
          pages[currentKey].main.replaceWith(page.main);
          currentKey = key;
          if (!page.ready) {
            page.ready = true;
            setupForm();
          }
          applyLanguage(language);
          if (addToHistory) window.history.pushState(null, "", addresses[key] + link.hash);
          // Scroll before the pods animate, so their movement can't throw the position off.
          page.main.classList.remove("is-entering");
          scrollFor(link.hash);
          void page.main.offsetWidth;
          page.main.classList.add("is-entering");
          var heading = $("h1", page.main);
          if (heading && !link.hash) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
          }
        })
        .catch(function () {
          if (request !== latest) return;
          currentKey = fromKey;
          window.location.href = link.href;
        });
    }

    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
      if (new URL(link.href).origin !== window.location.origin || !isOurPage(link.href)) return;
      event.preventDefault();
      goTo(link.href, true);
    });

    window.addEventListener("popstate", function () {
      goTo(window.location.href, false);
    });

    settle();
    document.addEventListener("lh:language", settle);
    window.addEventListener("resize", settle);
    window.addEventListener("pageshow", settle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);

    // Fetch the other page ahead of time so switching is instant.
    var other = items.filter(function (item) {
      return pageKey(item.href) !== currentKey;
    })[0];
    if (other) {
      load(pageKey(other.href), other.href).catch(function () {
        /* It will be tried again on click. */
      });
    }
  }

  // ---------- Form ----------

  function setupForm() {
    var form = $("#signup");
    if (!form) return;

    var state = { weight: "", gender: "male", agreed: false };
    var select = setupWeightSelect(form, state);
    var slide = setupSlide(form, state);
    var submit = $("[data-submit]", form);
    var submitLabel = $("[data-submit-label]", form);
    var formError = $("[data-form-error]", form);
    var success = $("[data-success]");
    var telegram = $("#telegram", form);

    // The @ is always shown in the field's icon, so people only type what follows it.
    telegram.addEventListener("input", function () {
      var cleaned = telegram.value.replace(/^@+/, "");
      if (cleaned !== telegram.value) telegram.value = cleaned;
    });

    var age = $("#age", form);
    age.addEventListener("input", function () {
      var cleaned = age.value.replace(/\D/g, "").slice(0, 2);
      if (cleaned !== age.value) age.value = cleaned;
    });

    // Optional. Accepts "name", "@name" or a pasted profile link, and keeps just the username.
    var instagram = $("#instagram", form);
    function instagramHandle() {
      return instagram.value.trim()
        .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
        .replace(/[/?#].*$/, "")
        .replace(/^@+/, "");
    }

    $$('input[name="gender"]', form).forEach(function (radio) {
      radio.addEventListener("change", function () {
        state.gender = radio.value;
        $("[data-toggle]", form).dataset.active = radio.value;
        state.weight = "";
        select.render();
        clearFieldError("weight");
      });
    });

    var checks = {
      name: function () {
        // First and last name: at least two words that contain a letter, in any alphabet.
        var words = $("#name", form).value.trim().split(/\s+/).filter(function (word) {
          return /\p{L}/u.test(word);
        });
        return words.length >= 2 ? "" : "errName";
      },
      age: function () {
        var value = Number(age.value);
        return /^\d+$/.test(age.value) && value >= 10 && value <= 99 ? "" : "errAge";
      },
      weight: function () {
        return state.weight ? "" : "errWeight";
      },
      phone: function () {
        var digits = $("#phone", form).value.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15 ? "" : "errPhone";
      },
      telegram: function () {
        return /^[A-Za-z0-9_]{5,32}$/.test(telegram.value.trim()) ? "" : "errTelegram";
      },
      instagram: function () {
        var handle = instagramHandle();
        return !handle || /^[A-Za-z0-9._]{1,30}$/.test(handle) ? "" : "errInstagram";
      },
      consent: function () {
        return state.agreed ? "" : "errConsent";
      },
    };

    var activeErrors = {};

    function showFieldError(name, key) {
      var group = $('[data-field="' + name + '"]', form);
      var message = $("[data-error]", group);
      activeErrors[name] = key;
      message.textContent = t(key);
      message.hidden = false;
      group.classList.add("is-invalid");
      var control = name === "weight" ? $("#weight-button", form) : name === "consent" ? $("[data-slide]", form) : $("#" + name, form);
      control.setAttribute("aria-invalid", "true");
    }

    function clearFieldError(name) {
      var group = $('[data-field="' + name + '"]', form);
      var message = $("[data-error]", group);
      delete activeErrors[name];
      message.hidden = true;
      message.textContent = "";
      group.classList.remove("is-invalid");
      var control = name === "weight" ? $("#weight-button", form) : name === "consent" ? $("[data-slide]", form) : $("#" + name, form);
      control.removeAttribute("aria-invalid");
    }

    ["name", "age", "phone", "telegram", "instagram"].forEach(function (name) {
      $("#" + name, form).addEventListener("input", function () {
        if (activeErrors[name] && !checks[name]()) clearFieldError(name);
      });
    });
    form.addEventListener("lh:weight", function () {
      clearFieldError("weight");
    });
    form.addEventListener("lh:consent", function () {
      if (state.agreed) clearFieldError("consent");
    });

    var formErrorKey = "";
    function setFormError(key) {
      formErrorKey = key;
      formError.hidden = !key;
      formError.textContent = key ? t(key) : "";
    }

    document.addEventListener("lh:language", function () {
      select.render();
      Object.keys(activeErrors).forEach(function (name) {
        showFieldError(name, activeErrors[name]);
      });
      if (formErrorKey) setFormError(formErrorKey);
    });

    function validate() {
      var firstInvalid = null;
      ["name", "age", "weight", "phone", "telegram", "instagram", "consent"].forEach(function (name) {
        var key = checks[name]();
        if (key) {
          showFieldError(name, key);
          firstInvalid = firstInvalid || name;
        } else {
          clearFieldError(name);
        }
      });
      if (!firstInvalid) return true;
      var target = firstInvalid === "weight" ? $("#weight-button", form) : firstInvalid === "consent" ? $("[data-slide]", form) : $("#" + firstInvalid, form);
      target.focus();
      return false;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setFormError("");
      if (!validate()) return;

      // Bots fill in the hidden field. Pretend it worked and send nothing.
      if ($('[name="_gotcha"]', form).value) {
        showSuccess();
        return;
      }

      if (!CONFIG.formEndpoint) {
        setFormError("errNotConnected");
        return;
      }

      submit.disabled = true;
      submitLabel.textContent = t("sending");
      fetch(CONFIG.formEndpoint, {
        method: "POST",
        // Plain text keeps this a "simple" request, which is what Google Apps Script accepts.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name: $("#name", form).value.trim(),
          age: Number(age.value),
          gender: state.gender,
          weight_class: state.weight.replace("−", "-") + " kg",
          phone: $("#phone", form).value.trim(),
          telegram: "@" + telegram.value.trim(),
          instagram: instagramHandle() ? "@" + instagramHandle() : "",
          language: LANGS[language],
          agreed_to_rules_and_waiver: true,
        }),
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Status " + response.status);
          return response.json();
        })
        .then(function (result) {
          // Apps Script always answers 200, so the real outcome is in the reply.
          if (!result || result.ok !== true) throw new Error("Not saved");
          showSuccess();
        })
        .catch(function () {
          setFormError("errSend");
        })
        .then(function () {
          submit.disabled = false;
          submitLabel.textContent = t("submit");
        });
    });

    function showSuccess() {
      form.hidden = true;
      success.hidden = false;
      success.focus();
    }

    $("[data-reset]").addEventListener("click", function () {
      form.reset();
      state.weight = "";
      state.gender = "male";
      $("[data-toggle]", form).dataset.active = "male";
      select.render();
      slide.set(false);
      Object.keys(activeErrors).forEach(clearFieldError);
      setFormError("");
      success.hidden = true;
      form.hidden = false;
      $("#name", form).focus();
    });
  }

  function setupWeightSelect(form, state) {
    var root = $("[data-select]", form);
    var button = $("#weight-button", root);
    var panel = $("[data-select-panel]", root);
    var valueNode = $("[data-select-value]", root);
    var hidden = $("#weight", root);
    var activeIndex = -1;

    function label(value) {
      return value + " " + t("kg");
    }

    function options() {
      return $$(".select__option", panel);
    }

    function render() {
      panel.innerHTML = "";
      WEIGHTS[state.gender].forEach(function (value, index) {
        var option = document.createElement("li");
        option.className = "select__option";
        option.id = "weight-option-" + index;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(value === state.weight));
        option.dataset.value = value;
        option.textContent = label(value);
        panel.appendChild(option);
      });
      hidden.value = state.weight;
      valueNode.textContent = state.weight ? label(state.weight) : t("weightClass");
      valueNode.classList.toggle("has-value", Boolean(state.weight));
    }

    function setActive(index) {
      var all = options();
      activeIndex = Math.max(0, Math.min(index, all.length - 1));
      all.forEach(function (option, i) {
        option.classList.toggle("is-active", i === activeIndex);
      });
      button.setAttribute("aria-activedescendant", all[activeIndex].id);
      all[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function setOpen(open) {
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) {
        var selected = WEIGHTS[state.gender].indexOf(state.weight);
        setActive(selected >= 0 ? selected : 0);
      } else {
        button.removeAttribute("aria-activedescendant");
        activeIndex = -1;
      }
    }

    function choose(value) {
      state.weight = value;
      render();
      setOpen(false);
      button.focus();
      form.dispatchEvent(new CustomEvent("lh:weight"));
    }

    button.addEventListener("click", function () {
      button.focus(); // Safari doesn't focus buttons on click, which would break the keys below.
      setOpen(panel.hidden);
    });

    panel.addEventListener("click", function (event) {
      var option = event.target.closest(".select__option");
      if (option) choose(option.dataset.value);
    });

    button.addEventListener("keydown", function (event) {
      var open = !panel.hidden;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) return setOpen(true);
        setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      } else if (open && event.key === "Home") {
        event.preventDefault();
        setActive(0);
      } else if (open && event.key === "End") {
        event.preventDefault();
        setActive(options().length - 1);
      } else if (open && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        choose(options()[activeIndex].dataset.value);
      } else if (open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      } else if (open && event.key === "Tab") {
        setOpen(false);
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-select]")) setOpen(false);
    });

    render();
    return { render: render };
  }

  // Slide to agree. Dragging, tapping, Space, Enter and the arrow keys all work,
  // so nobody needs to be able to drag to sign up.
  function setupSlide(form, state) {
    var slide = $("[data-slide]", form);
    var thumb = $(".slide__thumb", slide);
    var travel = slide.offsetWidth - thumb.offsetWidth || 40;
    var drag = null;
    var suppressClick = false;

    function set(on) {
      state.agreed = on;
      slide.setAttribute("aria-checked", String(on));
      slide.style.removeProperty("--slide-x");
      form.dispatchEvent(new CustomEvent("lh:consent"));
    }

    slide.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      travel = slide.offsetWidth - thumb.offsetWidth;
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startOffset: state.agreed ? travel : 0,
        offset: state.agreed ? travel : 0,
        moved: false,
      };
      slide.setPointerCapture(event.pointerId);
    });

    slide.addEventListener("pointermove", function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      var delta = event.clientX - drag.startX;
      if (Math.abs(delta) > 3) drag.moved = true;
      if (!drag.moved) return;
      drag.offset = Math.max(0, Math.min(travel, drag.startOffset + delta));
      slide.classList.add("is-dragging");
      slide.style.setProperty("--slide-x", drag.offset + "px");
    });

    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      var finished = drag;
      drag = null;
      slide.classList.remove("is-dragging");
      if (finished.moved) {
        suppressClick = true;
        set(finished.offset > travel / 2);
      }
    }

    slide.addEventListener("pointerup", endDrag);
    slide.addEventListener("pointercancel", function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      slide.classList.remove("is-dragging");
      slide.style.removeProperty("--slide-x");
    });

    slide.addEventListener("click", function () {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      set(!state.agreed);
    });

    slide.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        set(true);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        set(false);
      }
    });

    return { set: set };
  }

  // ---------- Start ----------

  setupLanguageMenu();
  setupForm();
  applyLanguage(readSavedLanguage() || "en");
  setupNavigation();
})();
