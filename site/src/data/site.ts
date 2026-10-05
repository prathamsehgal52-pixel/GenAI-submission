export const brand = 'Armoire'

export const navLeft = [
  { label: 'Wardrobe', href: '#wardrobe' },
  { label: 'Closet', href: '#closet' },
  { label: 'Stylist', href: '#stylist' },
]

export const navRight = [
  { label: 'Discover', href: '#discover' },
  { label: 'How it works', href: '#how' },
]

export const pillars = [
  {
    index: '01/WARDROBE',
    title: ['Every piece', 'you own,', 'beautifully', 'organised.'],
    altWords: ['beautifully', 'organised.'],
    chip: 'Digital wardrobe',
    href: '#closet',
    image: '/images/knit-rack.jpg',
    crop: '50% 40%',
  },
  {
    index: '02/STYLIST',
    title: ['Outfits', 'built from', 'what you', 'already love.'],
    altWords: ['Outfits', 'built'],
    chip: 'AI personal stylist',
    href: '#stylist',
    image: '/images/blue-coat.jpg',
    crop: '50% 30%',
    alignBottom: true,
  },
]

export const steps = [
  {
    n: '01',
    title: 'Snap your clothes',
    body: 'Photograph pieces on a hanger, the floor or a chair. Armoire removes the background and tags each one.',
  },
  {
    n: '02',
    title: 'Get styled daily',
    body: 'Choose an occasion and the weather. Your stylist builds complete outfits only from what you own.',
  },
  {
    n: '03',
    title: 'Shop with intent',
    body: 'New releases are ranked by how many outfits they would create from your closet, so you buy less and wear more.',
  },
]
