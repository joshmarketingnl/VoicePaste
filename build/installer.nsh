; VoicePaste installer: two screens, minimal words.
; Screen 1 (welcome): the privacy promise in three bullets.
; Screen 2 (finish): done + "made by Josh" contact link.
;
; BRANDING_URL is the only place to change the contact link.
; Josh's business WhatsApp with a friendly prefilled opener:
; "Hoi Josh! Ik kwam via VoicePaste. Ik wil graag vrijblijvend sparren over AI."
!define BRANDING_URL "https://wa.me/31647569554?text=Hoi%20Josh!%20Ik%20kwam%20via%20VoicePaste.%20Ik%20wil%20graag%20vrijblijvend%20sparren%20over%20AI."

!ifndef BUILD_UNINSTALLER
Function LaunchVoicePaste
  ExecShell "" "$INSTDIR\${PRODUCT_FILENAME}.exe"
FunctionEnd
!endif

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "VoicePaste"
  !define MUI_WELCOMEPAGE_TEXT "Spraak wordt tekst. 100% op je eigen computer.$\r$\n$\r$\n\
  •  Alles blijft op jouw pc$\r$\n\
  •  Niets gaat naar internet$\r$\n\
  •  Geen account, geen abonnement$\r$\n$\r$\n\
Klik op Volgende om te installeren."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "Klaar"
  !define MUI_FINISHPAGE_TEXT "VoicePaste is geïnstalleerd. Hij draait in je systeemvak (naast de klok) en start voortaan vanzelf mee."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "VoicePaste nu starten"
  !define MUI_FINISHPAGE_RUN_FUNCTION LaunchVoicePaste
  !define MUI_FINISHPAGE_LINK "Gemaakt door Josh — vrijblijvend sparren over AI? App me."
  !define MUI_FINISHPAGE_LINK_LOCATION "${BRANDING_URL}"
  !insertmacro MUI_PAGE_FINISH
!macroend
