/**
 * IDs AliExpress trouvés via Exa Search, en attente de scrape og:image.
 * AliExpress a rate-limité les IPs le 2026-04-05 — retry quand débloqué.
 *
 * Pour récupérer les images:
 * curl -sL --max-time 12 -H "User-Agent: Mozilla/5.0 ..." \
 *   "https://www.aliexpress.com/item/{ID}.html" | rg -o 'og:image.*?content="([^"]+)"' -r '$1'
 */

export const PENDING_PRODUCT_IDS = {
  mugs: [
    { id: '1005007131667829', title: 'Anime One Piece Ceramic Cup Cosplay Mug Luffy Zoro' },
    { id: '1005007104245252', title: 'One Piece Mug Luffy Ceramics Coffee Cup Anime Figure' },
    { id: '1005006033546850', title: 'Anime One Piece Mug Hat Shaped Creative Water Cup' },
    { id: '1005010319972066', title: '400ml Anime One Piece Cosplay Ceramics Mug' },
    { id: '1005010151193881', title: 'Anime One Piece Ceramic Cup Classics Dopamine' },
    { id: '1005007819326780', title: 'Anime One Piece Luffy Zoro Insulated Cup' },
  ],
  phoneCases: [
    { id: '1005006344649615', title: 'Anime One Piece Luffy Nika Gear 5 Phone Case iPhone' },
    { id: '1005005046894623', title: 'One Piece Luffy Silicone Phone Case iPhone' },
    { id: '1005006748843275', title: 'Anime One Piece Luffy Zoro Eye Ladder Phone Case' },
    { id: '1005007253824447', title: 'Anime One Piece Sanji Usopp Liquid Phone Case' },
    { id: '1005008012706937', title: 'Cool Anime One Piece Luffy Gradient Phone Case' },
  ],
  keychains: [
    { id: '1005009445403226', title: 'Anime One Piece Key Chains Cartoon Luffy Zoro Sanji' },
    { id: '1005004613106464', title: 'Anime One Piece Keychain Luffy Ace Law Edward Newgate' },
    { id: '1005007380664752', title: 'NEW ONE PIECE Key Chain Sound Pendant' },
    { id: '1005007837143168', title: 'One Piece Luffy Straw Hat Keychain Alloy Model' },
    { id: '1005007348090434', title: 'One Piece Keychain Luffy Ace Skull Logo Wanted Order' },
  ],
  posters: [
    { id: '1005007451136263', title: 'Anime One Piece Luffy Zoro Wanted Poster HD Canvas' },
    { id: '1005007097001432', title: 'Bandai One Piece Poster Hanging Picture Luffy Nami Zoro' },
    { id: '1005006244765827', title: 'One Piece Self-adhesive Poster Bounty Order Luffy' },
    { id: '1005006084948320', title: 'One Piece Anime Poster Wall Art Luffy Zoro' },
    { id: '1005005944195069', title: 'Home Wall Decoration Poster Bandai Anime One Piece' },
  ],
  bags: [
    { id: '1005007988449056', title: 'Anime One Piece Luffy Logo Crossbody Sling Backpack' },
    { id: '1005007524355108', title: 'Anime One Piece Naruto Dragon Ball Backpack' },
    { id: '1005005609871762', title: 'One Piece Luffy Printing Backpack School Bag' },
    { id: '1005008228380502', title: 'Anime Loungefly One Piece Luffy Zoro Backpack' },
    { id: '1005006200074910', title: 'Anime One Piece Shoulder Bag Luffy Zoro Nami' },
  ],
} as const;
