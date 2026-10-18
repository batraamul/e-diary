/* E-Diary — line icons (24×24, stroke = currentColor) */
(function () {
  'use strict';
  const ED = window.ED;

  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    chevU: '<path d="M6 15l6-6 6 6"/>',
    updown: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    pencil: '<path d="M4 20l1.1-4.6L16.2 4.3a2.1 2.1 0 013 3L8.1 18.4 4 20z"/><path d="M14.3 6.2l3.5 3.5"/>',
    hand: '<path d="M8.5 11.5V4.2a1.6 1.6 0 013.2 0v6.3"/><path d="M11.7 9.6a1.6 1.6 0 013.2 0v1.6"/><path d="M14.9 10.4a1.6 1.6 0 013.2 0v1.4"/><path d="M18.1 11.6a1.6 1.6 0 013.2 0V15c0 3.9-2.6 7-6.6 7h-1.3c-2.4 0-3.8-.8-5.3-2.5l-3.7-4.3a1.7 1.7 0 012.5-2.3l1.6 1.7"/>',
    info: '<circle cx="12" cy="12" r="9.3"/><path d="M12 11v6"/><circle class="fill" cx="12" cy="7.6" r="1.15"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.7 7.7 0 000-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 00-2.6-1.5L14 2.3h-4l-.4 2.6A7.6 7.6 0 007 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 000 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 002.6 1.5l.4 2.6h4l.4-2.6a7.6 7.6 0 002.6-1.5l2.4.9 2-3.4-2-1.6z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/>',
    eye: '<path d="M2.2 12s3.6-6.8 9.8-6.8S21.8 12 21.8 12s-3.6 6.8-9.8 6.8S2.2 12 2.2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.3A10 10 0 0112 5.2c6.2 0 9.8 6.8 9.8 6.8a17 17 0 01-3.1 4M6.5 6.8A16.6 16.6 0 002.2 12s3.6 6.8 9.8 6.8a9.6 9.6 0 004.6-1.2"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
    cloud: '<path d="M7 18.5h10.2a4.3 4.3 0 00.4-8.6A6 6 0 006.3 8.4 5 5 0 007 18.5z"/>',
    cloudCheck: '<path d="M7 18.5h10.2a4.3 4.3 0 00.4-8.6A6 6 0 006.3 8.4 5 5 0 007 18.5z"/><path d="M9.4 13.6l1.9 1.9 3.6-3.8"/>',
    cloudOff: '<path d="M3 3l18 18"/><path d="M8.3 8.4A5 5 0 007 18.5h10.2c.5 0 1-.1 1.4-.2M20.9 15.4a4.3 4.3 0 00-3.3-5.5A6 6 0 0010.9 5"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.2v2.2M12 19.6v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.2 12h2.2M19.6 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
    moon: '<path d="M20 14.6A8.2 8.2 0 019.4 4a8.2 8.2 0 1010.6 10.6z"/>',
    auto: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2" /><path class="fill" d="M12 3.4a8.6 8.6 0 010 17.2z"/>',
    thermo: '<path d="M14 14.6V5a2 2 0 00-4 0v9.6a4 4 0 104 0z"/><path d="M12 9v7.2"/>',
    trophy: '<path d="M8 4h8v5.2a4 4 0 01-8 0V4z"/><path d="M8 6H5.2a2.8 2.8 0 002.9 3.7M16 6h2.8a2.8 2.8 0 01-2.9 3.7M12 13.2V17M8.5 20.5h7M9.8 17h4.4"/>',
    star: '<path class="fill" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>',
    starO: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.6 2H4.4l1.6-2z"/><path d="M10 20.8a2.1 2.1 0 004 0"/>',
    repeat: '<path d="M17 2.8l3 3-3 3"/><path d="M4 11V9.8a4 4 0 014-4h12"/><path d="M7 21.2l-3-3 3-3"/><path d="M20 13v1.2a4 4 0 01-4 4H4"/>',
    watch: '<circle cx="12" cy="13.6" r="7.4"/><path d="M12 13.6v-4M9.8 2.6h4.4M12 2.6v3.6M18.2 6.8l1.4-1.4"/>',
    check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
    arrowR: '<path d="M4.5 12h14M13 6l6 6-6 6"/>',
    arrowL: '<path d="M19.5 12h-14M11 6l-6 6 6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.2 20.6a7.8 7.8 0 0115.6 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.6 19.8a6.4 6.4 0 0112.8 0"/><path d="M15.5 5.3a3.4 3.4 0 010 6.4M17.5 14.2a6.3 6.3 0 013.9 5.6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    xCircle: '<circle cx="12" cy="12" r="9.3"/><path d="M9 9l6 6M15 9l-6 6"/>',
    compass: '<circle cx="12" cy="12" r="9.3"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5 5-2.2z"/>',
    target: '<circle cx="12" cy="12" r="9.3"/><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="2.3"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><rect class="fill" x="7" y="13" width="4" height="4" rx=".8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle class="fill" cx="4.6" cy="6.5" r="1.2"/><circle class="fill" cx="4.6" cy="12" r="1.2"/><circle class="fill" cx="4.6" cy="17.5" r="1.2"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sort: '<path d="M7 4v16M3.8 16.8L7 20l3.2-3.2M17 20V4M13.8 7.2L17 4l3.2 3.2"/>',
    doc: '<path d="M6 2.8h8.2L19 7.6v13.6H6z"/><path d="M14 2.8v5h5"/>',
    docPlus: '<path d="M6 2.8h8.2L19 7.6v13.6H6z"/><path d="M14 2.8v5h5M12.5 11v6M9.5 14h6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5A2.5 2.5 0 006.5 23H20v-5"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 2.8-2.8L20.5 19"/>',
    download: '<path d="M12 3.5v11.5M7 10.2l5 5 5-5M4.5 20.5h15"/>',
    upload: '<path d="M12 15.5V4M7 8.8l5-5 5 5M4.5 20.5h15"/>',
    sync: '<path d="M20 11a8 8 0 00-14.3-4.6L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0014.3 4.6l1.7-2.1M20 20v-4.5h-4.5"/>',
    help: '<circle cx="12" cy="12" r="9.3"/><path d="M9.3 9.2a2.8 2.8 0 015.4 1c0 1.9-2.7 2.4-2.7 4"/><circle class="fill" cx="12" cy="17.4" r="1.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    more: '<circle class="fill" cx="5.5" cy="12" r="1.6"/><circle class="fill" cx="12" cy="12" r="1.6"/><circle class="fill" cx="18.5" cy="12" r="1.6"/>',
    expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
    collapse: '<path d="M20 4l-6.5 6.5M14 4.5v6h6M4 20l6.5-6.5M10 19.5v-6H4"/>',
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.4V20h12V9.4M10 20v-5h4v5"/>',
    share: '<circle cx="18" cy="5.6" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.4" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>',
    copy: '<rect x="8" y="8" width="12.5" height="12.5" rx="2"/><path d="M16 8V5.5A2 2 0 0014 3.5H5.5a2 2 0 00-2 2V14a2 2 0 002 2H8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    chat: '<path d="M4 18.8l1.2-3.7A7.8 7.8 0 1112 20a7.8 7.8 0 01-3.8-1z"/>',
    link: '<path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>',
    file: '<path d="M6 2.8h8.2L19 7.6v13.6H6z"/><path d="M14 2.8v5h5M9 13h6M9 17h6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 19V7.5A1.5 1.5 0 015.5 6H10"/>',
    drag: '<circle class="fill" cx="9" cy="6" r="1.4"/><circle class="fill" cx="15" cy="6" r="1.4"/><circle class="fill" cx="9" cy="12" r="1.4"/><circle class="fill" cx="15" cy="12" r="1.4"/><circle class="fill" cx="9" cy="18" r="1.4"/><circle class="fill" cx="15" cy="18" r="1.4"/>',
    chart: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7" rx=".6"/><rect x="10.5" y="7" width="3" height="11" rx=".6"/><rect x="15" y="13.5" width="3" height="4.5" rx=".6"/>',
    cap: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.2c1.6 1.6 3.4 2.3 5.5 2.3s3.9-.7 5.5-2.3V11M21.5 9v5"/>',
    flag: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
    printer: '<path d="M7 8V3.5h10V8"/><rect x="3.5" y="8" width="17" height="8.5" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    forward: '<path d="M13 5l7 7-7 7"/><path d="M4 12h15.5"/>',
    renumber: '<path d="M4 6h3v5M4 11h6M4 15.5a1.8 1.8 0 013.5-.6c0 1.6-3.5 2.1-3.5 4.1h3.6"/><path d="M13 7h7M13 12h7M13 17h7"/>',
    bold: '<path d="M7 4.5h6a3.5 3.5 0 010 7H7zM7 11.5h7a3.8 3.8 0 010 7.5H7z"/>',
    italic: '<path d="M10 4.5h8M6 19.5h8M14.5 4.5l-5 15"/>',
    underline: '<path d="M7 4v7a5 5 0 0010 0V4M5 20.5h14"/>',
    strike: '<path d="M4.5 12h15M16.5 7.5a4 3.3 0 00-4.5-2.8c-2.6 0-4.2 1.3-4.2 3 0 1.3.9 2.2 2.4 2.8M7.5 16a4.2 3.4 0 004.5 3.2c2.7 0 4.4-1.4 4.4-3.3 0-.7-.2-1.3-.6-1.8"/>',
    ul: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle class="fill" cx="4.6" cy="6.5" r="1.3"/><circle class="fill" cx="4.6" cy="12" r="1.3"/><circle class="fill" cx="4.6" cy="17.5" r="1.3"/>',
    ol: '<path d="M10 6.5h10M10 12h10M10 17.5h10M4 5h1.6v4M3.7 9h3M3.8 13.4a1.4 1.4 0 012.6.4c0 1.3-2.7 1.8-2.7 3.4h2.9"/>',
    heading: '<path d="M6 4.5v15M18 4.5v15M6 12h12"/>',
    quote: '<path d="M9.5 7.5H6.5A1.5 1.5 0 005 9v3a1.5 1.5 0 001.5 1.5h3V16a3 3 0 01-3 3M19 7.5h-3A1.5 1.5 0 0014.5 9v3a1.5 1.5 0 001.5 1.5h3V16a3 3 0 01-3 3"/>',
    alignC: '<path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10"/>',
    alignL: '<path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10"/>',
    color: '<path d="M6.5 16.5L12 4l5.5 12.5M8.4 12.3h7.2"/><rect class="fill" x="4" y="18.5" width="16" height="2.6" rx="1"/>',
    clear: '<path d="M4 7V5h16v2M10 5l-3 14M14 5l-1.2 5.6"/><path d="M15 15l5 5M20 15l-5 5"/>',
    hr: '<path d="M3.5 12h17"/><path d="M7 7h10M7 17h10" opacity=".35"/>',
    checkSq: '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3"/><path d="M8 12.2l2.8 2.8L16.2 9"/>',
    square: '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3"/>',
    wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 0110.2-2.4M19 13a10 10 0 00-2.2-1.6M2 9a15 15 0 0115.8-3.3M22 9a15 15 0 00-3-2.2"/><circle class="fill" cx="12" cy="19.6" r="1.2"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3M16.5 6.5l2.5 2.5M14.2 8.8l2 2"/>',
    install: '<rect x="3.5" y="3.5" width="17" height="12.5" rx="2"/><path d="M8 20.5h8M12 16v4.5M12 6.5v6M9.3 9.8l2.7 2.7 2.7-2.7"/>',
    sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    pin: '<path d="M9 3.5h6l-1 5 3.5 3.5v1.5h-11V12L10 8.5z"/><path d="M12 13.5v7"/>',
    // weather
    wallet: '<path d="M4 7.5A2.5 2.5 0 016.5 5H18v3"/><rect x="4" y="7.5" width="16.5" height="12" rx="2"/><path d="M20.5 11.5h-4a2 2 0 000 4h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
    unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 017.6-1.7"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.6"/>',
    history: '<path d="M4 12a8 8 0 102.3-5.7"/><path d="M4 4v3.5h3.5M12 8v4.5l3 1.8"/>',
    trendUp: '<path d="M4 17l5.5-5.5 3.5 3.5L20 8"/><path d="M15 8h5v5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    cart: '<path d="M3 4h2.2l2.3 10.6a1.6 1.6 0 001.6 1.3h8.3a1.6 1.6 0 001.6-1.2L21 8H6.1"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2A4.6 4.6 0 0021 10.6C21 6.4 17 3 12 3z"/><circle class="fill" cx="7.5" cy="11" r="1.2"/><circle class="fill" cx="10" cy="7.3" r="1.2"/><circle class="fill" cx="14.5" cy="7.3" r="1.2"/><circle class="fill" cx="17.2" cy="10.6" r="1.2"/>',
    phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.2"/><path d="M10.5 18h3"/>',
    piggy: '<path d="M5 11.5c0-3.6 3.4-6 7.2-6 3 0 5.4 1.3 6.6 3.4l1.7-.4-.4 2.6c.6.9.9 1.8.9 2.9 0 1.8-1 3.3-2.5 4.3V21h-3v-1.6c-.8.2-1.6.3-2.5.3s-1.6-.1-2.4-.3V21h-3v-2.5C5.9 17.4 5 15.3 5 13.5"/><path d="M5 11.5c-1.2 0-2-.8-2-1.8M15.5 10.5h.01" stroke-width="2"/>',
    closeBook: '<path d="M5 4.5A1.5 1.5 0 016.5 3H19v16H6.5A1.5 1.5 0 005 20.5z"/><path d="M5 20.5A1.5 1.5 0 006.5 22H19v-3M15 3v7l-2-1.5L11 10V3"/>',
    wSun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.2v2.2M12 19.6v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.2 12h2.2M19.6 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
    wMoon: '<path d="M19.5 14.6A8 8 0 019.4 4.5a8 8 0 1010.1 10.1z"/>',
    wPartly: '<path d="M8.5 3.5v1.6M3.4 8.6H5M4.9 5l1.1 1.1M12.1 5l-1.1 1.1"/><path d="M5.8 11.3a3.4 3.4 0 015.9-3.1"/><path d="M8.5 19.5h9.2a3.7 3.7 0 00.3-7.4 5.2 5.2 0 00-9.8-.6 4 4 0 00.3 8z"/>',
    wCloud: '<path d="M7 18.5h10.2a4.3 4.3 0 00.4-8.6A6 6 0 006.3 8.4 5 5 0 007 18.5z"/>',
    wFog: '<path d="M6.5 13.5h11a3.6 3.6 0 00.2-7.2A5.2 5.2 0 007.6 5.7 4 4 0 006.5 13.5z"/><path d="M4 17h16M6 20.5h12"/>',
    wDrizzle: '<path d="M7 14.5h10.2a3.9 3.9 0 00.3-7.8A5.6 5.6 0 006.6 5.5 4.5 4.5 0 007 14.5z"/><path d="M8.5 17.5v1M12 17.5v1M15.5 17.5v1M10.2 20.5v.6M13.8 20.5v.6"/>',
    wRain: '<path d="M7 14.5h10.2a3.9 3.9 0 00.3-7.8A5.6 5.6 0 006.6 5.5 4.5 4.5 0 007 14.5z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
    wSnow: '<path d="M7 14.5h10.2a3.9 3.9 0 00.3-7.8A5.6 5.6 0 006.6 5.5 4.5 4.5 0 007 14.5z"/><path d="M8.5 18.2h.01M12 17.2h.01M15.5 18.2h.01M10.2 21h.01M13.8 21h.01" stroke-width="2.4"/>',
    wStorm: '<path d="M7 14.5h10.2a3.9 3.9 0 00.3-7.8A5.6 5.6 0 006.6 5.5 4.5 4.5 0 007 14.5z"/><path d="M12.8 13.5l-2.3 4h3l-2.3 4"/>',
  };

  ED.icon = (name, cls) =>
    '<svg class="ic ic-' + name + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || P.help) + '</svg>';

  /* circled letter badge — the "D" (daily) marker used on repeating tasks */
  ED.letterIcon = (ch, cls) =>
    '<svg class="ic ic-letter' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9.3"/><text x="12" y="16.1" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor" stroke="none">' + ch + '</text></svg>';

  /* the binder's ring (drawn once per ring; the metal gradient lives in #ed-defs) */
  ED.ringSVG = () =>
    '<svg class="ring" viewBox="0 0 96 34" aria-hidden="true" focusable="false">' +
    '<ellipse cx="9" cy="24" rx="5.5" ry="4.2" fill="rgba(0,0,0,.42)"/>' +
    '<ellipse cx="87" cy="24" rx="5.5" ry="4.2" fill="rgba(0,0,0,.42)"/>' +
    '<path d="M9 24 C 9 3, 87 3, 87 24" fill="none" stroke="url(#edRing)" stroke-width="6.5" stroke-linecap="round"/>' +
    '<path d="M12 21 C 14 7.5, 82 7.5, 84 21" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg>';

  ED.brandSVG = () =>
    '<svg class="brand-mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' +
    '<defs> <linearGradient id="edBL" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#8a4029"/> <stop offset="1" stop-color="#4c1b0f"/> </linearGradient> <linearGradient id="edBH" x1="0" y1="0" x2="1" y2="1"> <stop offset="0" stop-color="#6cb8ff"/> <stop offset="1" stop-color="#2f7df6"/> </linearGradient> </defs> <rect x="16" y="16" width="480" height="480" rx="104" fill="url(#edBL)"/> <rect x="38" y="38" width="436" height="436" rx="86" fill="none" stroke="#e8c58c" stroke-opacity=".55" stroke-width="5" stroke-dasharray="16 11"/> <rect x="380" y="130" width="46" height="62" rx="12" fill="#ef6412"/> <rect x="380" y="200" width="46" height="62" rx="12" fill="#f2ad1c"/> <rect x="380" y="270" width="46" height="62" rx="12" fill="#2a8f3a"/> <rect x="96" y="92" width="304" height="330" rx="22" fill="#f4f4f1"/> <path d="M96 138v-24a22 22 0 0122-22h260a22 22 0 0122 22v24z" fill="url(#edBH)"/> <circle cx="146" cy="196" r="20" fill="#2e7d32"/> <path d="M136 196l7 7 14-15" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/> <rect x="182" y="184" width="170" height="24" rx="12" fill="#b3261e"/> <circle cx="146" cy="262" r="18" fill="none" stroke="#8a8f97" stroke-width="6"/> <rect x="182" y="250" width="140" height="24" rx="12" fill="#0f2a6e"/> <circle cx="146" cy="328" r="18" fill="none" stroke="#8a8f97" stroke-width="6"/> <rect x="182" y="316" width="156" height="24" rx="12" fill="#1f6fe0"/> <path d="M110 96c0-30 30-30 30 0" fill="none" stroke="#dfe4ea" stroke-width="9" stroke-linecap="round"/> <path d="M356 96c0-30 30-30 30 0" fill="none" stroke="#dfe4ea" stroke-width="9" stroke-linecap="round"/>' +
    '</svg>';
})();
