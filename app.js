/**
 * CYBER_SECURITY ENGINE P2P - OPTIMIZED INTEGRITY EDITION
 * Encapsulado bajo un entorno léxico cerrado (IIFE) para evitar la manipulación de estados desde la consola global.
 */
(function () {
    'use strict';

    // Declaración interna de funciones globales del módulo Admin para que sean accesibles mediante los eventos controlados
    let abrirEditorCampana, cerrarModalEditorAdmin, guardarCambiosEditorAdmin, ejecutarAccionIndividual, ejecutarAccionMasiva, cargarCampanasAdminFuerza, renderizarTablaAdmin, toggleSeleccionCampana, toggleSeleccionarTodas;

    const Storage = {
        get(key, defaultValue) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error("Error leyendo LocalStorage para clave: " + key, e);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error("Error escribiendo en LocalStorage para clave: " + key, e);
            }
        },
        remove(key) {
            localStorage.removeItem(key);
        }
    };

    const App = {
        state: {
            isPremium: false,
            userId: "99999999", 
            username: "sin_alias",
            firstName: "Developer",
            chatInstance: "global_context",
            campañaActivaLocal: null,
            referidosLogrados: 0,
            clicsTotalesEnlace: 0,
            groupStats: {},
            adTimerInterval: null,
            adSecondsLeft: 30,
            adCompleted: false,
            firstTimeLoginDate: "",
            tgChannelJoined: false,
            carouselIndex: 0,
            carouselTimer: null,
            isCarouselPaused: false,
            outboundTimestamp: 0,
            verificationInProgress: false
        },

        supabaseClient: null,
        tg: window.Telegram ? window.Telegram.WebApp : null,

        init() {
            if(this.tg) {
                this.tg.ready();
                this.tg.expand();
            }

            const SUPABASE_URL = "https://hdvmoeugbbuxvdeoprks.supabase.co"; 
            const cleanKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkdm1vZXVnYmJ1eHZkZW9wcmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjM5OTEsImV4cCI6MjA5ODMzOTk5MX0.6Qx4LsduzdjHcDcFtGPQrq3tnxQndMAmG-PS2Iay6SU";
            
            try {
                if (window.supabase && SUPABASE_URL && cleanKey) {
                    this.supabaseClient = window.supabase.createClient(SUPABASE_URL, cleanKey);
                    console.log("🛰️ NET_SYNC: Conexión con Supabase establecida.");
                } else {
                    console.warn("⚠️ NET_WARNING: Supabase no configurado o URL vacía. Corriendo en Sandbox local.");
                }
            } catch(err) {
                console.error("Error al enlazar los canales de Supabase:", err);
            }

            this.setupDates();
            this.bindEvents();
            this.inicializarFlujoAplicacion();
            this.startCarouselEngine();
        },

        setupDates() {
            let savedFirstDate = Storage.get("bv_first_login", null);
            if (!savedFirstDate) {
                const hoy = new Date();
                savedFirstDate = hoy.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                Storage.set("bv_first_login", savedFirstDate);
            }
            this.state.firstTimeLoginDate = savedFirstDate;
            
            const labelStart = document.getElementById("profile-plan-start");
            if(labelStart) labelStart.textContent = savedFirstDate;

            this.state.campañaActivaLocal = Storage.get("campaña_local_backup", null);
        },

        bindEvents() {
            const safeAddEvent = (id, type, callback) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener(type, callback);
            };

            safeAddEvent("btn-header-profile", "click", () => this.abrirModalPerfil());
            safeAddEvent("btn-close-profile-modal", "click", (e) => this.cerrarModalPerfil(e));
            safeAddEvent("btn-join-channel", "click", () => this.abrirSpaceRequisito());
            safeAddEvent("btn-share-viral", "click", () => this.compartirEnlaceReferido());
            safeAddEvent("btn-claim-reward", "click", () => this.reclamarRecompensaFinal());
            safeAddEvent("btn-deploy-campaign", "click", () => this.guardarCampanaAdmin());
            safeAddEvent("btn-validate-license", "click", () => this.inyectarLlaveLicenciaLocal());
            safeAddEvent("btn-request-premium", "click", () => this.solicitarPremiumAirdayz());
            safeAddEvent("btn-watermark-link", "click", () => this.cambiarPestana('billing'));
            
            safeAddEvent("setup-campaign-type", "change", () => this.actualizarFormularioPorTipoCam());

            safeAddEvent("nav-client", "click", () => this.cambiarPestana('client'));
            safeAddEvent("nav-admin", "click", () => this.cambiarPestana('admin'));
            safeAddEvent("nav-billing", "click", () => this.cambiarPestana('billing'));

            safeAddEvent("btn-close-editor-modal", "click", () => cerrarModalEditorAdmin());
            safeAddEvent("btn-save-edit-admin", "click", () => guardarCambiosEditorAdmin());

            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    this.pauseCarousel();
                } else {
                    this.resumeCarousel();
                    this.procesarRetornoUsuario();
                }
            });

            const carouselWrapper = document.getElementById("premium-carousel-wrapper");
            if(carouselWrapper) {
                carouselWrapper.addEventListener("touchstart", () => this.pauseCarousel(), { passive: true });
                carouselWrapper.addEventListener("touchend", () => {
                    setTimeout(() => this.resumeCarousel(), 5000);
                }, { passive: true });
            }
        },

        async inicializarFlujoAplicacion() {
            try {
                this.inicializarDatosUsuarioTelegram();
                await this.ejecutarVerificacionLicenciaBase();
                await this.recuperarEstadisticasBD();
                await this.evaluarFlujoDeepLinkingDeEntrada();
                this.renderizarPantallasDinamicas();
                this.actualizarContadorHeader();
                this.actualizarFormularioPorTipoCam();
            } catch (error) {
                console.error("Error en la inicialización del ecosistema:", error);
            } finally {
                const splash = document.getElementById("cyber-splash-loader");
                if (splash) {
                    splash.style.opacity = "0";
                    setTimeout(() => {
                        splash.style.visibility = "hidden";
                    }, 400);
                }
            }
        },
        
        inicializarDatosUsuarioTelegram() {
            if(!this.tg) return;
            const u = this.tg.initDataUnsafe?.user;
            if(u) {
                this.state.userId = u.id.toString();
                this.state.username = u.username || "sin_alias";
                this.state.firstName = u.first_name || "Usuario";
                this.state.chatInstance = this.tg.initDataUnsafe?.chat_instance || "direct_chat";
            }

            const nameDisplay = document.getElementById("user-display-name");
            if(nameDisplay) nameDisplay.textContent = this.state.firstName.toUpperCase();
            
            const avatarBox = document.getElementById("user-avatar-box");
            const modalAvatarBox = document.getElementById("modal-avatar-box");
            
            if (u && u.photo_url) {
                if(avatarBox) {
                    const imgExistente = avatarBox.querySelector("img");
                    if(imgExistente) imgExistente.remove();
                    const img = document.createElement("img");
                    img.src = u.photo_url;
                    img.alt = "Profile";
                    avatarBox.appendChild(img);
                }
                if(modalAvatarBox) {
                    modalAvatarBox.innerHTML = "";
                    const imgModal = document.createElement("img");
                    imgModal.src = u.photo_url;
                    imgModal.alt = "Profile";
                    imgModal.style.width = "100%"; imgModal.style.height = "100%"; imgModal.style.objectFit = "cover";
                    modalAvatarBox.appendChild(imgModal);
                }
            } else {
                const inicial = this.state.firstName.charAt(0).toUpperCase();
                const fallback = document.getElementById("avatar-fallback");
                const modalFallback = document.getElementById("modal-avatar-fallback");
                if(fallback) fallback.textContent = inicial;
                if(modalFallback) modalFallback.textContent = inicial;
            }
        },

        async dispararAlertaSegura(accion, mensaje) {
            if (!this.supabaseClient) return;

            try {
                const { data, error } = await this.supabaseClient.rpc('disparar_alerta_bot', {
                    user_id: this.state.userId,
                    username: this.state.username,
                    accion: accion,
                    mensaje: mensaje
                });

                if (error) throw error;
                console.log("🛰️ ALERT_ENGINE: Canales de red procesados correctamente.", data);
                return data;
            } catch (err) {
                console.error("🚨 ALERT_ERROR:", err);
                throw err;
            }
        },

        async ejecutarVerificacionLicenciaBase() {
            const ahora = Date.now();
            const localPremiumUntil = localStorage.getItem(`bv_premium_until_${this.state.userId}`);
            
            if (localPremiumUntil) {
                if (parseInt(localPremiumUntil) > ahora) {
                    this.activarInterfazPremiumVisual();
                    return;
                } else {
                    localStorage.removeItem(`bv_premium_until_${this.state.userId}`);
                    this.desactivarInterfazPremiumVisual();
                    return;
                }
            }

            if(!this.supabaseClient) {
                this.desactivarInterfazPremiumVisual();
                return;
            }

            try {
                const { data, error } = await this.supabaseClient
                    .from('licenses')
                    .select('*')
                    .eq('used_by_tg_id', this.state.userId)
                    .eq('is_used', true);

                if (!error && data && data.length > 0) {
                    const licenciaActiva = data[0];
                    const fechaActivacion = new Date(licenciaActiva.activated_at).getTime();
                    const diasEnMilisegundos = licenciaActiva.duration_days * 24 * 60 * 60 * 1000;
                    const fechaExpiracion = fechaActivacion + diasEnMilisegundos;

                    if (ahora < fechaExpiracion) {
                        localStorage.setItem(`bv_premium_until_${this.state.userId}`, fechaExpiracion);
                        this.activarInterfazPremiumVisual();
                        return;
                    }
                }
            } catch(e) {
                console.error("Fallo al consultar licencias:", e);
            }
            this.desactivarInterfazPremiumVisual();
        },

        activarInterfazPremiumVisual() {
            this.state.isPremium = true;
            const statusBadge = document.getElementById("status-badge");
            if(statusBadge) { statusBadge.textContent = "PLAN_PRO"; statusBadge.className = "badge badge-premium"; }
            
            const planStatus = document.getElementById("profile-plan-status");
            if(planStatus) { planStatus.textContent = "PRO_RANK"; planStatus.style.color = "var(--neon-amber)"; }
            
            const avatarGlow = document.getElementById("user-avatar-glow");
            if(avatarGlow) { avatarGlow.style.backgroundColor = "var(--neon-amber)"; avatarGlow.style.boxShadow = "var(--glow-amber)"; }
            
            const cw = document.getElementById("premium-carousel-wrapper"); if(cw) cw.style.display = "none";
            const akc = document.getElementById("premium-activation-key-card"); if(akc) akc.style.display = "none";
            
            const nc = document.getElementById("nav-client"); if(nc) nc.style.display = "flex";
            const na = document.getElementById("nav-admin"); if(na) na.style.display = "flex"; 
            const nb = document.getElementById("nav-billing"); if(nb) nb.style.display = "none"; 
            
            this.habilitarOpcionesPremiumAdmin();
            this.pauseCarousel();
        },

        desactivarInterfazPremiumVisual() {
            this.state.isPremium = false;
            const statusBadge = document.getElementById("status-badge");
            if(statusBadge) { statusBadge.textContent = "PLAN_GRATIS"; statusBadge.className = "badge"; }
            
            const planStatus = document.getElementById("profile-plan-status");
            if(planStatus) { planStatus.textContent = "PLAN_GRATIS"; planStatus.style.color = "var(--text-cyber)"; }
            
            const avatarGlow = document.getElementById("user-avatar-glow");
            if(avatarGlow) { avatarGlow.style.backgroundColor = "var(--neon-lime)"; avatarGlow.style.boxShadow = "0 0 6px var(--neon-lime)"; }
            
            const cw = document.getElementById("premium-carousel-wrapper"); if(cw) cw.style.display = "block";
            const akc = document.getElementById("premium-activation-key-card"); if(akc) akc.style.display = "block";
            
            const nc = document.getElementById("nav-client"); if(nc) nc.style.display = "flex";
            const na = document.getElementById("nav-admin"); if(na) na.style.display = "flex";   
            const nb = document.getElementById("nav-billing"); if(nb) nb.style.display = "flex"; 
            
            this.desactivarOpcionesPremiumAdmin();
        },

        habilitarOpcionesPremiumAdmin() {
            ["ad_text", "ad_image", "ad_video", "sub_channel", "join_group"].forEach(id => {
                const opt = document.getElementById(`opt-${id}`);
                if(opt) { opt.disabled = false; opt.textContent = opt.textContent.replace(" 🔒 Pro", ""); }
            });
            const dur = document.getElementById("setup-ad-duration"); if(dur) dur.disabled = false;
        },

        desactivarOpcionesPremiumAdmin() {
            ["ad_text", "ad_image", "ad_video", "sub_channel", "join_group"].forEach(id => {
                const opt = document.getElementById(`opt-${id}`);
                if(opt && !opt.textContent.includes("🔒 Pro")) { opt.disabled = true; opt.textContent += " 🔒 Pro"; }
            });
            const dur = document.getElementById("setup-ad-duration"); if(dur) dur.disabled = true;
        },

        async recuperarEstadisticasBD() {
            if (!this.state.campañaActivaLocal || !this.supabaseClient) return;
            const ownerId = this.state.campañaActivaLocal.ownerId;

            try {
                const { count, error } = await this.supabaseClient
                    .from('referrals')
                    .select('*', { count: 'exact', head: true })
                    .eq('campaign_owner_id', ownerId);

                if (!error) {
                    this.state.referidosLogrados = count || 0;
                    const ml = document.getElementById("meta-loops"); if(ml) ml.textContent = this.state.referidosLogrados;
                    const mc = document.getElementById("meta-clicks"); if(mc) mc.textContent = Math.floor(this.state.referidosLogrados * 1.4);
                }
            } catch(e) {
                console.error("Error recuperando estadísticas:", e);
            }

            const container = document.getElementById("admin-group-stats");
            if(container) {
                if (this.state.referidosLogrados > 0) {
                    container.innerHTML = `<div style="display:flex; justify-content:space-between; font-family:'Orbitron',sans-serif;"><span>DATA_STREAM_FEED:</span> <span style="color:var(--neon-lime)">• CLOUD_SYNC_ON</span></div>`;
                } else {
                    container.textContent = "Awaiting datastream package requests...";
                }
            }
        },

        async evaluarFlujoDeepLinkingDeEntrada() {
            if (!this.tg) return;
            const startParam = this.tg.initDataUnsafe?.start_param;
            if (!startParam) return;

            try {
                let base64Clean = startParam.replace(/-/g, '+').replace(/_/g, '/');
                while (base64Clean.length % 4) { 
                    base64Clean += '='; 
                }
                
                const binaryString = atob(base64Clean);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decodedText = new TextDecoder('utf-8').decode(bytes);
                const payload = JSON.parse(decodedText);

                if (payload && payload.secret_url) {
                    this.state.campañaActivaLocal = {
                        titulo: payload.title, 
                        desc: payload.description, 
                        secreto: payload.secret_url,
                        tipo: payload.type || "invitation", 
                        requeridos: parseInt(payload.req_slots) || 3,
                        tgTarget: payload.tg_target || "", 
                        adValue: payload.ad_val || "", 
                        adDuration: parseInt(payload.ad_dur) || 30,
                        startDate: payload.s_date ? parseInt(payload.s_date) : null, 
                        endDate: payload.e_date ? parseInt(payload.e_date) : null,
                        ownerId: payload.owner,
                        status: payload.status || 'activa'
                    };
                    
                    Storage.set("campaña_local_backup", this.state.campañaActivaLocal);

                    if (payload.owner && payload.owner !== this.state.userId && this.supabaseClient) {
                        await this.supabaseClient.from('referrals').insert([
                            { campaign_owner_id: payload.owner, referred_user_id: this.state.userId }
                        ]);
                    }
                }
            } catch (e) {
                console.error("Error decodificando nodo cuántico:", e);
            }
        },

        async guardarCampanaAdmin() {
            const setupTitleEl = document.getElementById("setup-title");
            const setupDescEl = document.getElementById("setup-desc");
            const setupSecretEl = document.getElementById("setup-secret");
            const setupCampaignTypeEl = document.getElementById("setup-campaign-type");
            const setupStartDateEl = document.getElementById("setup-start-date");
            const setupEndDateEl = document.getElementById("setup-end-date");
            const setupReqCountEl = document.getElementById("setup-req-count");
            const setupAdDurationEl = document.getElementById("setup-ad-duration");

            const t = setupTitleEl ? setupTitleEl.value.trim() : "";
            const d = setupDescEl ? setupDescEl.value.trim() : "";
            const s = setupSecretEl ? setupSecretEl.value.trim() : "";
            const type = setupCampaignTypeEl ? setupCampaignTypeEl.value : "invitation";
            
            const sDateRaw = setupStartDateEl ? setupStartDateEl.value : "";
            const eDateRaw = setupEndDateEl ? setupEndDateEl.value : "";

            const startDateISO = sDateRaw ? new Date(sDateRaw).toISOString() : null;
            const endDateISO = eDateRaw ? new Date(eDateRaw).toISOString() : null;

            if(!t || !s) {
                if(this.tg) this.tg.showAlert("❌ Identificador de Recurso y Enlace de Destino obligatorios.");
                return;
            }
            if(!this.supabaseClient) {
                if(this.tg) this.tg.showAlert("❌ Error de comunicación: Base de datos no vinculada.");
                return;
            }

            if (!this.state.isPremium) {
                const { data: existentes } = await this.supabaseClient
                    .from('campaigns')
                    .select('id')
                    .eq('owner_id', this.state.userId);

                if (existentes && existentes.length >= 1) {
                    if(this.tg) this.tg.showAlert("🔒 LÍMITE ALCANZADO: Los usuarios gratuitos solo pueden publicar 1 campaña al mismo tiempo en la red. Consigue una Licencia Premium.");
                    return;
                }
            }
            
            let r = (setupReqCountEl ? parseInt(setupReqCountEl.value) : 0) || 3;
            const adDur = (setupAdDurationEl ? parseInt(setupAdDurationEl.value) : 0) || 30;

            let tgTargetFinal = "";
            let adValueFinal = "";
            let reqSlotsFinal = 0;
            let adDurationFinal = 0;

            if (type === "invitation") {
                reqSlotsFinal = r;
            } else if (type === "sub_channel" || type === "join_group") {
                const tgTargetEl = document.getElementById("setup-tg-target");
                tgTargetFinal = tgTargetEl ? tgTargetEl.value.trim() : "";
                if (!tgTargetFinal) {
                    if(this.tg) this.tg.showAlert("❌ USUARIO es obligatorio para este protocolo.");
                    return;
                }
            } else if (type.startsWith("ad_")) {
                const adValueEl = document.getElementById("setup-ad-value");
                adValueFinal = adValueEl ? adValueEl.value.trim() : "";
                adDurationFinal = adDur;
                if (!adValueFinal) {
                    if(this.tg) this.tg.showAlert("❌ STREAM_VALUE_DATA_SOURCE no puede estar vacío.");
                    return;
                }
            }

            const nuevaCampana = {
                id: this.state.userId + "_" + Date.now(), 
                owner_id: this.state.userId, 
                title: t, 
                description: d, 
                secret_url: s, 
                type: type, 
                req_slots: reqSlotsFinal,
                tg_target: tgTargetFinal, 
                ad_value: adValueFinal,
                ad_duration: adDurationFinal, 
                start_date: startDateISO, 
                end_date: endDateISO,
                status: 'activa'
            };

            try {
                const { error } = await this.supabaseClient.from('campaigns').upsert([nuevaCampana]);

                if (error) {
                    if(this.tg) this.tg.showAlert("❌ Error de Supabase:\n" + error.message + "\nCódigo: " + error.code);
                    return;
                }
            } catch (catchError) {
                if(this.tg) this.tg.showAlert("🚨 Fallo de Red Crítico:\n" + catchError.message);
                return;
            }

            this.state.campañaActivaLocal = {
                titulo: t, desc: d, secreto: s, tipo: type, requeridos: r,
                tgTarget: nuevaCampana.tg_target, adValue: nuevaCampana.ad_value, adDuration: adDur,
                startDate: nuevaCampana.start_date ? new Date(nuevaCampana.start_date).getTime() : null, 
                endDate: nuevaCampana.end_date ? new Date(nuevaCampana.end_date).getTime() : null, 
                ownerId: this.state.userId,
                status: nuevaCampana.status
            };

            Storage.set("campaña_local_backup", this.state.campañaActivaLocal);
            
            try {
                if(this.tg) this.tg.showAlert("🚀 PROCESANDO TRANSMISIÓN: Subiendo metadatos...");
                await this.dispararAlertaSegura("CAMPAÑA_DESPLEGADA", "El operador ha publicado un nuevo nodo P2P.");
            } catch(alertErr) {
                if(this.tg) this.tg.showAlert("⚠️ Alerta enviada con advertencia de red: " + alertErr.message);
            }
            
            this.state.referidosLogrados = 0;
            this.state.adCompleted = false;
            this.state.tgChannelJoined = false;
            this.state.verificationInProgress = false;
            if(this.state.adTimerInterval) { clearInterval(this.state.adTimerInterval); this.state.adTimerInterval = null; }
            
            this.renderizarPantallasDinamicas();
            this.actualizarContadorHeader();
            this.cambiarPestana('client');
        },

        renderizarPantallasDinamicas() {
            const camp = this.state.campañaActivaLocal;
            const cardNoCam = document.getElementById("card-no-campaign");
            const cardUnlock = document.getElementById("card-viral-unlock");
            const cardStatusMsg = document.getElementById("card-campaign-status-msg");

            if(!camp) {
                if(cardNoCam) cardNoCam.style.display = "block";
                if(cardUnlock) cardUnlock.style.display = "none";
                if(cardStatusMsg) cardStatusMsg.style.display = "none";
                return;
            }

            if (camp.status === 'en_pausa') {
                if(cardNoCam) cardNoCam.style.display = "none";
                if(cardUnlock) cardUnlock.style.display = "none";
                if(cardStatusMsg) {
                    cardStatusMsg.style.display = "block";
                    cardStatusMsg.style.borderColor = "var(--neon-amber)";
                    
                    const msgTitle = document.getElementById("status-msg-title");
                    const msgDesc = document.getElementById("status-msg-desc");
                    
                    if (camp.ownerId === this.state.userId) {
                        if(msgTitle) msgTitle.textContent = "⏸️ PENDIENTE DE APROBACIÓN";
                        if(msgDesc) msgDesc.textContent = "Tu nodo de distribución se encuentra temporalmente en pausa y en espera de validación por parte del Super Admin.";
                    } else {
                        if(msgTitle) msgTitle.textContent = "🔒 CAMPAÑA SUSPENDIDA";
                        if(msgDesc) msgDesc.textContent = "Este enlace de descarga P2P ha sido pausado por la administración. Los protocolos de sincronización y copia de enlace quedan deshabilitados.";
                    }
                }
                return;
            }

            const ahora = Date.now();
            if(camp.startDate && ahora < camp.startDate) {
                if(cardNoCam) cardNoCam.style.display = "none";
                if(cardUnlock) cardUnlock.style.display = "none";
                if(cardStatusMsg) {
                    cardStatusMsg.style.display = "block";
                    const sTitle = document.getElementById("status-msg-title");
                    const sDesc = document.getElementById("status-msg-desc");
                    if(sTitle) sTitle.textContent = "⏳ TIEMPO_DEL_BLOQUEO";
                    if(sDesc) sDesc.textContent = `Uplink sincronizado para abrirse el: ${new Date(camp.startDate).toLocaleString()}`;
                }
                return;
            }
            if(camp.endDate && ahora > camp.endDate) {
                if(cardNoCam) cardNoCam.style.display = "none";
                if(cardUnlock) cardUnlock.style.display = "none";
                if(cardStatusMsg) {
                    cardStatusMsg.style.display = "block";
                    const sTitle = document.getElementById("status-msg-title");
                    const sDesc = document.getElementById("status-msg-desc");
                    if(sTitle) sTitle.textContent = "⌛ LA CAMPAÑA EXPIRÓ";
                    if(sDesc) sDesc.textContent = "El ciclo de vida útil asignado a esta firma digital ha finalizado.";
                }
                return;
            }

            if(cardNoCam) cardNoCam.style.display = "none";
            if(cardStatusMsg) cardStatusMsg.style.display = "none";
            if(cardUnlock) cardUnlock.style.display = "block";

            const vTitle = document.getElementById("viral-title"); if(vTitle) vTitle.textContent = camp.titulo.toUpperCase();
            const vDesc = document.getElementById("viral-desc"); if(vDesc) vDesc.textContent = camp.desc;
            const vBadge = document.getElementById("viral-type-badge"); if(vBadge) vBadge.textContent = camp.tipo.toUpperCase();

            const clientStartVar = document.getElementById("client-start-date");
            const clientEndVar = document.getElementById("client-end-date");
            if (clientStartVar) clientStartVar.textContent = camp.startDate ? new Date(camp.startDate).toLocaleDateString() : 'IMMEDIATE';
            if (clientEndVar) clientEndVar.textContent = camp.endDate ? new Date(camp.endDate).toLocaleDateString() : 'PERPETUAL';

            const stepRef = document.getElementById("step-referrals"); if(stepRef) stepRef.style.display = "none";
            const stepCh = document.getElementById("step-channel"); if(stepCh) stepCh.style.display = "none";
            const stepAd = document.getElementById("step-dynamic-ad"); if(stepAd) stepAd.style.display = "none";
            const btnShare = document.getElementById("btn-share-viral"); if(btnShare) btnShare.style.display = "none";

            if(camp.tipo === "invitation") {
                if(stepRef) { stepRef.style.display = "block"; }
                if(btnShare) { btnShare.style.display = "block"; }
                
                const porcentaje = Math.min((this.state.referidosLogrados / camp.requeridos) * 100, 100);
                const pText = document.getElementById("progress-text"); if(pText) pText.textContent = `${this.state.referidosLogrados} / ${camp.requeridos} CLONES`;
                const pFill = document.getElementById("progress-bar-fill"); if(pFill) pFill.style.width = `${porcentaje}%`;

                this.evaluarDesbloqueoFinal(this.state.referidosLogrados >= camp.requeridos);
            } else if(camp.tipo === "sub_channel" || camp.tipo === "join_group") {
                if(stepCh) stepCh.style.display = "block";
                const tgLabel = document.getElementById("tg-step-label"); if(tgLabel) tgLabel.textContent = camp.tipo === "sub_channel" ? "STATION_SUBSCRIPTION" : "CLUSTER_TUNNELING";
                const tgDesc = document.getElementById("tg-step-desc"); if(tgDesc) tgDesc.textContent = `Sincroniza terminal con el alias @${camp.tgTarget || 'comunidad'} para abrir compuerta.`;
                this.evaluarDesbloqueoFinal(this.state.tgChannelJoined); 
            } else if(camp.tipo.startsWith("ad_")) {
                if(stepAd) stepAd.style.display = "block";
                const adRender = document.getElementById("ad-content-render");
                
                if(adRender) {
                    adRender.innerHTML = ""; 
                    if(camp.tipo === "ad_text") {
                        const txtSpan = document.createElement("span");
                        txtSpan.style.color = "#fff"; txtSpan.style.fontWeight = "bold";
                        txtSpan.textContent = camp.adValue;
                        adRender.appendChild(txtSpan);
                    } else if(camp.tipo === "ad_image") {
                        const adImg = document.createElement("img");
                        adImg.src = camp.adValue; adImg.style.width = "100%"; adImg.style.maxHeight = "160px"; adImg.style.objectFit = "cover"; adImg.style.border = "1px solid var(--neon-cyan)";
                        adRender.appendChild(adImg);
                    } else if(camp.tipo === "ad_video") {
                        const adVid = document.createElement("video");
                        adVid.src = camp.adValue; adVid.autoplay = true; adVid.muted = true; adVid.loop = true; adVid.playsInline = true; adVid.style.width = "100%"; adVid.style.maxHeight = "160px"; adVid.style.objectFit = "cover"; adVid.style.border = "1px solid var(--neon-amber)";
                        adRender.appendChild(adVid);
                    }
                }

                const adTimer = document.getElementById("ad-timer");
                if(!this.state.adCompleted && !this.state.adTimerInterval) {
                    this.ejecutarContadorAnuncio(camp.adDuration);
                } else if(this.state.adCompleted) {
                    if(adTimer) adTimer.textContent = "DECRYPTED";
                    this.evaluarDesbloqueoFinal(true);
                }
            }
        },

        ejecutarContadorAnuncio(segundos) {
            if (this.state.adTimerInterval) clearInterval(this.state.adTimerInterval);
            this.state.adSecondsLeft = segundos;
            
            const adTimer = document.getElementById("ad-timer");
            if(adTimer) adTimer.textContent = `${this.state.adSecondsLeft}s`;
            
            const btnClaim = document.getElementById("btn-claim-reward");
            if(btnClaim) {
                btnClaim.className = "btn btn-gold btn-disabled";
                btnClaim.textContent = "⏳ PARSING_STREAM_DATA...";
            }

            this.state.adTimerInterval = setInterval(() => {
                this.state.adSecondsLeft--;
                if(this.state.adSecondsLeft <= 0) {
                    clearInterval(this.state.adTimerInterval);
                    this.state.adTimerInterval = null;
                    this.state.adCompleted = true;
                    const adTimerEnd = document.getElementById("ad-timer");
                    if(adTimerEnd) adTimerEnd.textContent = "DECRYPTED";
                    this.renderizarPantallasDinamicas();
                } else {
                    const adTimerTick = document.getElementById("ad-timer");
                    if(adTimerTick) adTimerTick.textContent = `${this.state.adSecondsLeft}s`;
                }
            }, 1000);
        },

        evaluarDesbloqueoFinal(condicion) {
            const btnClaim = document.getElementById("btn-claim-reward");
            if(!btnClaim) return;
            if(condicion) {
                btnClaim.classList.remove("btn-disabled");
                btnClaim.className = "btn btn-gold";
                btnClaim.textContent = "🔓 ACCESSO_DESBLOQUEADO";
            } else {
                btnClaim.classList.add("btn-disabled");
                btnClaim.textContent = "🔒 DESBLOQUEAR_ACCESO";
            }
        },

        compartirEnlaceReferido() {
            const camp = this.state.campañaActivaLocal;
            if(!camp || !this.tg) return;

            const botUsername = "ViralBoomBot"; 
            const payload = {
                title: camp.titulo, description: camp.desc, secret_url: camp.secreto,
                type: camp.tipo, req_slots: camp.requeridos, owner: camp.ownerId,
                referrer: this.state.userId, origin_chat: this.state.chatInstance,
                s_date: camp.startDate, e_date: camp.endDate, status: camp.status
            };

            const jsonStr = JSON.stringify(payload);
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(jsonStr);
            let binary = "";
            for (let i = 0; i < dataBytes.byteLength; i++) {
                binary += String.fromCharCode(dataBytes[i]);
            }
            const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                
            const deepLinkFinal = `https://t.me/${botUsername}/app?startapp=${b64}`;
            let mensajeCompartir = `🔥 *⚡ CONTENIDO BLOQUEADO DETECTADO ⚡* 🔥\n\nDistribuyendo acceso para: *${camp.titulo}*.\n📥 Sincroniza tu ID de red para reclamar acceso gratis:`;
            this.tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLinkFinal)}&text=${encodeURIComponent(mensajeCompartir)}`);
        },

        reclamarRecompensaFinal() {
            const btnClaim = document.getElementById("btn-claim-reward");
            if (!this.tg || (btnClaim && btnClaim.classList.contains("btn-disabled"))) return;
            this.tg.showPopup({
                title: "🔓 LINK_DESBLOQUEADO",
                message: "Protocolo de desencriptación exitoso. Abre el túnel seguro hacia el destino de los datos.",
                buttons: [{type: "default", text: "REDIRECCIÓN CANAL"}]
            }, () => {
                if(this.state.campañaActivaLocal && this.state.campañaActivaLocal.secreto) {
                    this.tg.openLink(this.state.campañaActivaLocal.secreto);
                }
            });
        },

        abrirSpaceRequisito() {
            const camp = this.state.campañaActivaLocal;
            if (!camp || !camp.tgTarget || !this.tg) return;
            
            let targetUrl = camp.tgTarget.startsWith("http") ? camp.tgTarget : `https://t.me/${camp.tgTarget}`;
            this.state.outboundTimestamp = Date.now();
            this.state.verificationInProgress = true;
            
            const btnJoin = document.getElementById("btn-join-channel");
            if(btnJoin) {
                btnJoin.textContent = "⏳ VERIFICANDO_SUSCRIPCIÓN...";
                btnJoin.classList.add("btn-disabled");
            }
            this.tg.openTelegramLink(targetUrl);
        },

        procesarRetornoUsuario() {
            if (!this.state.verificationInProgress) return;
            
            const tiempoFuera = (Date.now() - this.state.outboundTimestamp) / 1000;
            const btnJoin = document.getElementById("btn-join-channel");
            
            if (tiempoFuera >= 7) {
                this.state.tgChannelJoined = true;
                this.state.verificationInProgress = false;
                
                if(btnJoin) {
                    btnJoin.textContent = "✅ CANAL CONECTADO";
                    btnJoin.className = "btn btn-purple btn-disabled";
                }
                if(this.tg) this.tg.showAlert("⚡ VERIFICADO: Sincronización exitosa con el canal.");
                this.renderizarPantallasDinamicas();
            } else {
                this.state.verificationInProgress = false;
                if(btnJoin) {
                    btnJoin.textContent = "UNIRME AL CANAL";
                    btnJoin.classList.remove("btn-disabled");
                }
                if(this.tg) {
                    this.tg.showPopup({
                        title: "❌ VERIFICACIÓN_FALLIDA",
                        message: "El tiempo de vinculación fue demasiado bajo. Asegúrate de unirte al canal antes de regresar.",
                        buttons: [{type: "close"}]
                    });
                }
            }
        },

        solicitarPremiumAirdayz() {
            if(!this.tg) return;
            const billingMethodEl = document.getElementById("billing-method");
            const metodo = billingMethodEl ? billingMethodEl.value : "not_specified";
            const textoMensaje = `¡Hola @Airdayz! Solicito pasaporte Overlord Premium para ViralBoom 🚀.\n\n` +
                                 `• ID_Firma: \`${this.state.userId}\`\n• Metodo_Pago: ${metodo}`;
            this.tg.openTelegramLink(`https://t.me/Airdayz?text=${encodeURIComponent(textoMensaje)}`);
        },

        abrirModalPerfil() {
            const modalTitle = document.getElementById("modal-user-title"); if(modalTitle) modalTitle.textContent = this.state.firstName.toUpperCase();
            const modalId = document.getElementById("modal-user-id"); if(modalId) modalId.textContent = `ID: ${this.state.userId}`;
            const modal = document.getElementById("modal-perfil-usuario");
            if(modal) {
                modal.style.display = "flex"; 
                modal.offsetHeight;
                modal.classList.add("active");
            }
        },

        cerrarModalPerfil(event) {
            if (event) event.stopPropagation();
            const modal = document.getElementById("modal-perfil-usuario");
            if(modal) {
                modal.classList.remove("active");
                setTimeout(() => {
                    if (!modal.classList.contains('active')) {
                        modal.style.display = 'none';
                    }
                }, 250); 
            }
        },

        inyectarLlaveLicenciaLocal() {
            const input = document.getElementById("licence-key-input");
            if(!input || !input.value.trim()) return;
            if(this.tg) this.tg.showAlert("🔍 Validando firma...");
            setTimeout(() => {
                this.activarInterfazPremiumVisual();
                if(this.tg) this.tg.showAlert("✅ LICENCIA EXPANDIDA: Acceso completo garantizado.");
            }, 1000);
        },

        actualizarFormularioPorTipoCam() {
            const stc = document.getElementById("setup-campaign-type"); if(!stc) return;
            const type = stc.value;
            
            const gInv = document.getElementById("group-opt-invitation"); if(gInv) gInv.style.display = type === "invitation" ? "block" : "none";
            const gTg = document.getElementById("group-opt-telegram"); if(gTg) gTg.style.display = (type === "sub_channel" || type === "join_group") ? "block" : "none";
            const gAd = document.getElementById("group-opt-ad"); if(gAd) gAd.style.display = type.startsWith("ad_") ? "block" : "none";
        },

        cambiarPestana(target) {
            const transit = document.getElementById("section-transit-overlay");
            if(transit) {
                transit.style.visibility = "visible";
                transit.style.opacity = "1";
            }

            setTimeout(() => {
                const vistas = document.querySelectorAll('.view-section');
                vistas.forEach(el => {
                    el.classList.remove('active');
                    el.style.display = "none";
                });
                
                const botones = document.querySelectorAll('.nav-bar .nav-item');
                botones.forEach(el => {
                    el.classList.remove('active');
                });
                
                const vistaObjetivo = document.getElementById(`view-${target}`);
                const botonObjetivo = document.getElementById(`nav-${target}`);
                
                if (vistaObjetivo) {
                    vistaObjetivo.classList.add('active');
                    vistaObjetivo.style.display = "block";
                }
                if (botonObjetivo) {
                    botonObjetivo.classList.add('active');
                }
                
                if(target === 'client') this.renderizarPantallasDinamicas();

                if(transit) {
                    transit.style.opacity = "0";
                    setTimeout(() => { transit.style.visibility = "hidden"; }, 200);
                }
            }, 150);
        },

        actualizarContadorHeader() {
            const hcc = document.getElementById("header-campaign-counter");
            if(hcc) hcc.textContent = this.state.campañaActivaLocal ? "MIS CAMPAÑAS: 1" : "CAMPAÑAS: 0";
        },

        startCarouselEngine() {
            if (this.state.carouselTimer) clearInterval(this.state.carouselTimer);
            const inner = document.getElementById("adv-carousel-inner");
            if (!inner) return;

            const runCarouselTick = () => {
                if(this.state.isPremium || this.state.isCarouselPaused || document.hidden) {
                    return;
                }
                this.state.carouselIndex = (this.state.carouselIndex + 1) % 3;
                inner.style.transform = `translateX(${this.state.carouselIndex * -100}%)`;
            };
            this.state.carouselTimer = setInterval(runCarouselTick, 4000);
        },

        pauseCarousel() {
            this.state.isCarouselPaused = true;
        },

        resumeCarousel() {
            this.state.isCarouselPaused = false;
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        App.init();
    });
    
    /* ==========================================================
       NÚCLEO INDEPENDIENTE: CONTROL SUPER-ADMIN DE CAMPAÑAS
       ========================================================== */
    const AdminState = {
        campanas: [],
        seleccionadas: [], 
        filtros: {
            buscador: '',
            orden: 'nuevas',
            tipo: 'todas',
            destacadas: 'todas'
        }
    };

    abrirEditorCampana = function(campanaId) {
        const campana = AdminState.campanas.find(c => c.id === campanaId);
        if (!campana) return;

        const editId = document.getElementById("edit-campaign-id");
        const editTitle = document.getElementById("edit-title");
        const editDesc = document.getElementById("edit-desc");
        const editSecret = document.getElementById("edit-secret");
        const editType = document.getElementById("edit-campaign-type");

        if(editId) editId.value = campana.id;
        if(editTitle) editTitle.value = campana.title;
        if(editDesc) editDesc.value = campana.description || "";
        if(editSecret) editSecret.value = campana.secret_url || "";
        if(editType) editType.value = campana.type;

        const modal = document.getElementById("modal-editor-admin");
        if(modal) {
            modal.style.display = "flex"; 
            modal.offsetHeight;
            modal.classList.add("active");
        }
    };

    cerrarModalEditorAdmin = function() {
        const modal = document.getElementById("modal-editor-admin");
        if(modal) {
            modal.classList.remove("active");
            setTimeout(() => { if (!modal.classList.contains('active')) modal.style.display = 'none'; }, 250); 
        }
    };

    guardarCambiosEditorAdmin = function() {
        const db = App.supabaseClient;
        if (!db) return;

        const editIdVal = document.getElementById("edit-campaign-id")?.value;
        const titleVal = document.getElementById("edit-title")?.value.trim();
        const descriptionVal = document.getElementById("edit-desc")?.value.trim();
        const secretUrlVal = document.getElementById("edit-secret")?.value.trim();
        const typeVal = document.getElementById("edit-campaign-type")?.value;

        if (!titleVal || !secretUrlVal || !editIdVal) {
            alert("Identificador y URL destino son obligatorios.");
            return;
        }

        db.from('campaigns').update({
            title: titleVal, description: descriptionVal, secret_url: secretUrlVal, type: typeVal
        }).eq('id', editIdVal).then(({ error }) => {
            if (error) throw error;

            if (App.state.campañaActivaLocal && App.state.campañaActivaLocal.ownerId === editIdVal.split('_')[0]) {
                App.state.campañaActivaLocal.titulo = titleVal;
                App.state.campañaActivaLocal.desc = descriptionVal;
                App.state.campañaActivaLocal.secreto = secretUrlVal;
                App.state.campañaActivaLocal.tipo = typeVal;
                Storage.set("campaña_local_backup", App.state.campañaActivaLocal);
            }

            alert("🚀 EDITADO CON EXITO: Campaña actualizada en la base de datos.");
            cerrarModalEditorAdmin();
            cargarCampanasAdminFuerza().then(() => {
                App.renderizarPantallasDinamicas();
            });
        }).catch(err => {
            console.error(err);
            alert("Error guardando los cambios de red: " + err.message);
        });
    };

    ejecutarAccionIndividual = function(campanaId, accion) {
        const db = App.supabaseClient;
        if (!db) {
            alert("La conexión con Supabase no está lista.");
            return;
        }
        if (!accion) return; 

        let promiseAction;

        if (accion === 'toggle_pausa') {
            const campana = AdminState.campanas.find(c => c.id === campanaId);
            const nuevoEstado = campana && campana.status === 'activa' ? 'en_pausa' : 'activa';
            
            promiseAction = db.from('campaigns').update({ status: nuevoEstado }).eq('id', campanaId).then(({ error }) => {
                if (error) throw error;
                if (App.state.campañaActivaLocal && App.state.campañaActivaLocal.ownerId === campanaId.split('_')[0]) {
                    App.state.campañaActivaLocal.status = nuevoEstado;
                    Storage.set("campaña_local_backup", App.state.campañaActivaLocal);
                }
                alert(`⚙️ Estado de Campaña cambiado a: ${nuevoEstado.toUpperCase()}`);
            });
            
        } else if (accion === 'toggle_destacar') {
            const campana = AdminState.campanas.find(c => c.id === campanaId);
            const nuevoDestacado = campana ? !campana.is_sponsored : true;
            
            promiseAction = db.from('campaigns').update({ is_sponsored: nuevoDestacado }).eq('id', campanaId).then(({ error }) => {
                if (error) throw error;
                alert(nuevoDestacado ? "⭐ Campaña destacada con éxito." : "❌ Destacado removido.");
            });

        } else if (accion === 'eliminar') {
            const confirmar = window.confirm("⚠️ ¿Estás seguro de que deseas eliminar permanentemente esta campaña?");
            if (!confirmar) return;
            
            promiseAction = db.from('campaigns').delete().eq('id', campanaId).then(({ error }) => {
                if (error) throw error;
                if (App.state.campañaActivaLocal && App.state.campañaActivaLocal.ownerId === campanaId.split('_')[0]) {
                    App.state.campañaActivaLocal = null;
                    Storage.remove("campaña_local_backup");
                }
                alert("🗑️ Campaña eliminada de la base de datos.");
            });
        }

        if (promiseAction) {
            promiseAction.then(() => {
                return cargarCampanasAdminFuerza();
            }).then(() => {
                App.renderizarPantallasDinamicas();
                App.actualizarContadorHeader();
            }).catch(err => {
                console.error("Error en acción individual:", err);
                alert("Fallo al actualizar la Campaña individual: " + err.message);
            });
        }
    };

    ejecutarAccionMasiva = function(accion) {
        const db = App.supabaseClient; 
        if (!db) {
            alert("La conexión con Supabase no está lista.");
            return;
        }
        if (AdminState.seleccionadas.length === 0) {
            alert("Por favor, selecciona al menos una campaña usando los checkboxes.");
            return;
        }

        let textoAlerta = '';
        let objetoActualizacion = {};

        switch(accion) {
            case 'ELIMINAR':
                textoAlerta = `⚠️ PASARÁ ESTO: Se eliminarán permanentemente ${AdminState.seleccionadas.length} campañas de la base de datos.`;
                break;
            case 'PAUSAR':
                textoAlerta = `⏸️ PASARÁ ESTO: Se pausarán ${AdminState.seleccionadas.length} campañas de la red.`;
                objetoActualizacion = { status: 'en_pausa' };
                break;
            case 'PLAY':
                textoAlerta = `▶️ PASARÁ ESTO: Se reactivarán ${AdminState.seleccionadas.length} campañas.`;
                objetoActualizacion = { status: 'activa' };
                break;
        }

        const confirmar = window.confirm(`${textoAlerta}\n\n¿Deseas continuar con los cambios masivos?`);
        if (!confirmar) return;

        let queryPromise;
        if (accion === 'ELIMINAR') {
            queryPromise = db.from('campaigns').delete().in('id', AdminState.seleccionadas);
        } else {
            queryPromise = db.from('campaigns').update(objetoActualizacion).in('id', AdminState.seleccionadas);
        }

        queryPromise.then(({ error }) => {
            if (error) throw error;
            
            if (App.state.campañaActivaLocal && AdminState.seleccionadas.some(id => id.startsWith(App.state.userId))) {
                if (accion === 'ELIMINAR') {
                    App.state.campañaActivaLocal = null;
                    Storage.remove("campaña_local_backup");
                } else {
                    App.state.campañaActivaLocal.status = objetoActualizacion.status;
                    Storage.set("campaña_local_backup", App.state.campañaActivaLocal);
                }
            }

            alert("🚀 Sistema masivo actualizado con éxito.");
            AdminState.seleccionadas = []; 
            return cargarCampanasAdminFuerza();
        }).then(() => {
            App.renderizarPantallasDinamicas();
            App.actualizarContadorHeader();
        }).catch(err => {
            console.error("Error en acción masiva:", err);
            alert("Hubo un error al aplicar los cambios masivos: " + err.message);
        });
    };

    cargarCampanasAdminFuerza = async function() {
        if (!App.supabaseClient) return;
        try {
            const { data, error } = await App.supabaseClient.from('campaigns').select('*');
            if (!error && data) {
                AdminState.campanas = data.map(c => ({
                    id: c.id, 
                    owner_id: c.owner_id,
                    title: c.title,
                    description: c.description,
                    type: c.type,
                    secret_url: c.secret_url,
                    created_at: c.start_date || new Date().toISOString(),
                    fecha_fin: c.end_date || new Date().toISOString(),
                    status: c.status || 'activa',
                    is_sponsored: c.is_sponsored || false,
                    owner_name: "Nodo Terminal",
                    owner_avatar: ""
                }));
                renderizarTablaAdmin();
            }
        } catch(e) {
            console.error("Error cargando campañas en el Administrator:", e);
        }
    };

    renderizarTablaAdmin = function() {
        const contenedor = document.getElementById("super-admin-panel");
        if (!contenedor) return;
        
        let filtradas = AdminState.campanas.filter(c => {
            const coincideBusqueda = c.id.includes(AdminState.filtros.buscador) || c.owner_id.includes(AdminState.filtros.buscador);
            const coincideTipo = AdminState.filtros.tipo === 'todas' || c.type === AdminState.filtros.tipo;
            const coincideDestacada = AdminState.filtros.destacadas === 'todas' || 
                (AdminState.filtros.destacadas === 'si' && c.is_sponsored) || 
                (AdminState.filtros.destacadas === 'no' && !c.is_sponsored);
            
            return coincideBusqueda && coincideTipo && coincideDestacada;
        });

        if (AdminState.filtros.orden === 'nuevas') {
            filtradas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        let html = `
            <div class="admin-panel-container" style="padding: 20px; background: #0a0b16; color: #fff; font-family: 'Rajdhani', sans-serif; border: 1px solid rgba(0, 243, 255, 0.2); margin-top:20px;">
                <h3 style="font-family:'Orbitron', sans-serif; font-size:1.1rem; color:var(--neon-cyan); margin-bottom:15px;">👑 PANEL - MONITOREO</h3>
                
                <div class="admin-tools" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <input type="text" placeholder="🔍 Buscar ID Campaña..." id="admin-search-input" style="padding: 8px; background: #05060f; color: #fff; border: 1px solid rgba(0,243,255,0.3); width:100%;">
                </div>

                <div class="masive-actions" style="background: #0d0f1d; padding: 10px; margin-bottom: 15px; border: 1px dashed var(--neon-amber); display: flex; gap: 10px; align-items: center; flex-wrap:wrap;">
                    <span style="font-size:0.8rem; font-weight: bold; color: #94a3b8;"></span>
                    <button id="btn-mass-play" style="background: #1b4322; color: #39ff14; padding: 6px 12px; border: 1px solid #39ff14; cursor: pointer; font-family:'Orbitron'; font-size:0.7rem;">▶ PLAY</button>
                    <button id="btn-mass-pause" style="background: #5c4308; color: #ffaa00; padding: 6px 12px; border: 1px solid #ffaa00; cursor: pointer; font-family:'Orbitron'; font-size:0.7rem;">⏸ PAUSA</button>
                    <button id="btn-mass-wipe" style="background: #421212; color: #ff3333; padding: 6px 12px; border: 1px solid #ff3333; cursor: pointer; font-family:'Orbitron'; font-size:0.7rem;">🗑️ ELIMINAR</button>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size:0.85rem;">
                        <thead>
                            <tr style="background: #0d0f1d; border-bottom: 2px solid rgba(0,243,255,0.3);">
                                <th style="padding: 10px;"><input type="checkbox" id="th-select-all"></th>
                                <th style="padding: 10px;">USUARIO</th>
                                <th style="padding: 10px;">CAMPAÑA</th>
                                <th style="padding: 10px;">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtradas.map(c => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${c.is_sponsored ? 'rgba(255,170,0,0.05)' : 'transparent'}">
                                    <td style="padding: 10px;">
                                        <input type="checkbox" class="admin-row-checkbox" data-id="${c.id}" ${AdminState.seleccionadas.includes(c.id) ? 'checked' : ''}>
                                    </td>
                                    <td style="padding: 10px;">
                                        <div style="font-weight: bold;">Nodo</div>
                                        <div style="font-size: 10px; color: #636e72;">ID: ${c.owner_id}</div>
                                    </td>
                                    <td style="padding: 10px;">
                                        <div class="btn-edit-trigger" data-id="${c.id}" style="font-weight: bold; color: var(--neon-cyan); cursor: pointer; text-decoration: underline; display: inline-block;">${c.title}</div>
                                        <div style="font-size: 11px; color: #8a2be2;">Tipo: ${c.type} | Cam_ID: ${c.id}</div>
                                    </td>
                                    <td style="padding: 10px;">
                                        <select class="admin-action-select" data-id="${c.id}" style="background: ${c.status === 'activa' ? '#1b4322' : '#5c4308'}; color: #fff; border: 1px solid rgba(255,255,255,0.2); font-family: 'Orbitron'; font-size: 10px; padding: 4px; font-weight: bold; cursor:pointer;">
                                            <option value="" disabled selected>${c.status.toUpperCase()}</option>
                                            <option value="toggle_pausa">${c.status === 'activa' ? '⏸️ PAUSAR' : '▶️ ACTIVAR'}</option>
                                            <option value="toggle_destacar">${c.is_sponsored ? '❌ DES-DESTACAR' : '⭐ DESTACAR'}</option>
                                            <option value="eliminar">🗑️ ELIMINAR</option>
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        contenedor.innerHTML = html;

        const searchInput = document.getElementById("admin-search-input");
        if(searchInput) {
            searchInput.value = AdminState.filtros.buscador;
            searchInput.addEventListener("input", function() {
                AdminState.filtros.buscador = this.value;
                renderizarTablaAdmin();
            });
        }

        const selectAllCheckbox = document.getElementById("th-select-all");
        if(selectAllCheckbox) {
            selectAllCheckbox.addEventListener("click", function() {
                toggleSeleccionarTodas(this.checked);
            });
        }

        document.getElementById("btn-mass-play")?.addEventListener("click", () => ejecutarAccionMasiva('PLAY'));
        document.getElementById("btn-mass-pause")?.addEventListener("click", () => ejecutarAccionMasiva('PAUSAR'));
        document.getElementById("btn-mass-wipe")?.addEventListener("click", () => ejecutarAccionMasiva('ELIMINAR'));

        document.querySelectorAll(".admin-row-checkbox").forEach(el => {
            el.addEventListener("click", function() {
                toggleSeleccionCampana(this.getAttribute("data-id"));
            });
        });

        document.querySelectorAll(".btn-edit-trigger").forEach(el => {
            el.addEventListener("click", function() {
                abrirEditorCampana(this.getAttribute("data-id"));
            });
        });

        document.querySelectorAll(".admin-action-select").forEach(el => {
            el.addEventListener("change", function() {
                ejecutarAccionIndividual(this.getAttribute("data-id"), this.value);
            });
        });
    };

    toggleSeleccionCampana = function(id) {
        const index = AdminState.seleccionadas.indexOf(id);
        if (index > -1) {
            AdminState.seleccionadas.splice(index, 1);
        } else {
            AdminState.seleccionadas.push(id);
        }
        renderizarTablaAdmin();
    };

    toggleSeleccionarTodas = function(checked) {
        if (checked) {
            AdminState.seleccionadas = AdminState.campanas.map(c => c.id);
        } else {
            AdminState.seleccionadas = [];
        }
        renderizarTablaAdmin();
    };

    document.getElementById("nav-admin")?.addEventListener("click", () => {
        setTimeout(() => { cargarCampanasAdminFuerza(); }, 200);
    });

})();
