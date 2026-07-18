import type {
  CatalogFilters,
  CatalogPageView,
  CatalogQueryPort,
  HomePageView,
  MovieCardView,
  MovieDetailView,
  SearchPageView,
  SearchSuggestion,
} from "../application/catalog-query-port";

type FixtureMovie = MovieCardView &
  Readonly<{
    addedOrder: number;
    editorialRank: number;
    genreSlugs: readonly string[];
    popularity: number;
  }>;

const catalogImages = {
  cityNight: {
    alt: "Gece ışıklarıyla yükselen şehir binaları",
    focalPosition: "50% 45%",
    height: 1024,
    src: "/fixtures/catalog/city-night.jpg",
    width: 701,
  },
  fogCoast: {
    alt: "Sis altında kayalık Pasifik kıyısı",
    focalPosition: "64% 54%",
    height: 1228,
    src: "/fixtures/catalog/fog-coast.jpg",
    width: 1840,
  },
  railwayStation: {
    alt: "Geceyi tren istasyonunda geçiren yolcular",
    focalPosition: "47% 48%",
    height: 1024,
    src: "/fixtures/catalog/railway-station.jpg",
    width: 789,
  },
  theaterInterior: {
    alt: "Perdesi kapalı tarihî tiyatro salonu",
    focalPosition: "53% 52%",
    height: 810,
    src: "/fixtures/catalog/theater-interior.jpg",
    width: 1024,
  },
} as const;

const movies = {
  coast: {
    addedOrder: 5,
    editorialRank: 2,
    genreSlugs: ["dram", "gizem"],
    id: "00000000-0000-4000-8000-000000000001",
    popularity: 72,
    poster: catalogImages.fogCoast,
    rating: { average: 4.3, count: 24 },
    slug: "kiyidaki-sessizlik",
    title: "Kıyıdaki Sessizlik",
    year: 2026,
  },
  map: {
    addedOrder: 4,
    editorialRank: 3,
    genreSlugs: ["gizem", "gerilim"],
    id: "00000000-0000-4000-8000-000000000002",
    popularity: 64,
    poster: null,
    rating: { average: 4.1, count: 17 },
    slug: "golgelerin-haritasi",
    title: "Gölgelerin Haritası",
    year: 2025,
  },
  tomorrow: {
    addedOrder: 8,
    editorialRank: 6,
    genreSlugs: ["bilim-kurgu", "dram"],
    id: "00000000-0000-4000-8000-000000000003",
    popularity: 58,
    poster: null,
    rating: null,
    slug: "yarin-kalanlar",
    title: "Yarın Kalanlar",
    year: 2026,
  },
  compass: {
    addedOrder: 2,
    editorialRank: 7,
    genreSlugs: ["macera"],
    id: "00000000-0000-4000-8000-000000000004",
    popularity: 49,
    poster: null,
    rating: { average: 3.9, count: 11 },
    slug: "kirik-pusula",
    title: "Kırık Pusula",
    year: 2024,
  },
  rehearsal: {
    addedOrder: 3,
    editorialRank: 4,
    genreSlugs: ["dram", "komedi"],
    id: "00000000-0000-4000-8000-000000000005",
    popularity: 88,
    poster: catalogImages.theaterInterior,
    rating: { average: 4.5, count: 31 },
    slug: "sonbahar-provasi",
    title: "Sonbahar Provası",
    year: 2025,
  },
  shift: {
    addedOrder: 1,
    editorialRank: 8,
    genreSlugs: ["gerilim"],
    id: "00000000-0000-4000-8000-000000000006",
    popularity: 42,
    poster: catalogImages.cityNight,
    rating: null,
    slug: "gece-vardiyasi",
    title: "Gece Vardiyası",
    year: 2023,
  },
  station: {
    addedOrder: 7,
    editorialRank: 1,
    genreSlugs: ["dram", "gizem"],
    id: "00000000-0000-4000-8000-000000000007",
    popularity: 91,
    poster: catalogImages.railwayStation,
    rating: { average: 4.6, count: 42 },
    slug: "ay-isiginda-son-istasyon",
    title: "Ay Işığında Son İstasyon",
    year: 2026,
  },
  wind: {
    addedOrder: 6,
    editorialRank: 5,
    genreSlugs: ["dram"],
    id: "00000000-0000-4000-8000-000000000008",
    popularity: 54,
    poster: null,
    rating: null,
    slug: "ruzgarin-unuttugu-sehrin-uzun-gecesi",
    title: "Rüzgârın Unuttuğu Şehrin Bitmek Bilmeyen Uzun Gecesi",
    year: 2025,
  },
  frequency: {
    addedOrder: 9,
    editorialRank: 9,
    genreSlugs: ["bilim-kurgu", "gizem"],
    id: "00000000-0000-4000-8000-000000000009",
    popularity: 46,
    poster: null,
    rating: { average: 4, count: 14 },
    slug: "sessiz-frekans",
    title: "Sessiz Frekans",
    year: 2024,
  },
  atlas: {
    addedOrder: 10,
    editorialRank: 10,
    genreSlugs: ["macera"],
    id: "00000000-0000-4000-8000-000000000010",
    popularity: 39,
    poster: null,
    rating: null,
    slug: "tasra-atlasi",
    title: "Taşra Atlası",
    year: 2023,
  },
} satisfies Record<string, FixtureMovie>;

const allMovies = Object.values(movies);
const genreOptions = [
  { name: "Bilim kurgu", slug: "bilim-kurgu" },
  { name: "Dram", slug: "dram" },
  { name: "Gerilim", slug: "gerilim" },
  { name: "Gizem", slug: "gizem" },
  { name: "Komedi", slug: "komedi" },
  { name: "Macera", slug: "macera" },
] as const;

type DetailExtras = Readonly<{
  ageRating: string | null;
  credits: readonly Readonly<{ label: string; names: readonly string[] }>[];
  originalTitle: string | null;
  runtimeMinutes: number;
  subtitleLanguages: readonly string[];
  synopsis: string;
}>;

const detailExtras: Readonly<Record<string, DetailExtras>> = {
  "ay-isiginda-son-istasyon": {
    ageRating: "13+",
    credits: [
      { label: "Yönetmen", names: ["Selin Yalın"] },
      { label: "Senaryo", names: ["Emre Tan", "Selin Yalın"] },
      { label: "Oyuncular", names: ["Nehir Ekin", "Mert Alaz", "Duru İlhan"] },
    ],
    originalTitle: "The Last Station Under Moonlight",
    runtimeMinutes: 104,
    subtitleLanguages: ["Türkçe", "İngilizce"],
    synopsis:
      "Dağların arasındaki son istasyonda çalışan iki yabancı, aynı gece yarım kalmış bir yolculuğun izini sürer.",
  },
  "gece-vardiyasi": {
    ageRating: "16+",
    credits: [
      { label: "Yönetmen", names: ["Ozan Erden"] },
      { label: "Oyuncular", names: ["Aslı Yüce", "Bora Kınalı"] },
    ],
    originalTitle: null,
    runtimeMinutes: 92,
    subtitleLanguages: ["Türkçe"],
    synopsis:
      "Şehrin son gece otobüsünde çalışan bir şoför, her durakta aynı yolcuyla karşılaşmaya başlar.",
  },
  "golgelerin-haritasi": {
    ageRating: "13+",
    credits: [
      { label: "Yönetmen", names: ["Aylin Gür"] },
      { label: "Senaryo", names: ["Baran Tunca"] },
      { label: "Oyuncular", names: ["İpek Noyan", "Can Ilgaz"] },
    ],
    originalTitle: null,
    runtimeMinutes: 111,
    subtitleLanguages: ["Türkçe", "İngilizce"],
    synopsis:
      "Eski bir şehir planında beliren işaretler, iki arşivciyi kayıp mahallelerin hikâyesine götürür.",
  },
  "kirik-pusula": {
    ageRating: "7+",
    credits: [
      { label: "Yönetmen", names: ["Deniz Aksoy"] },
      { label: "Oyuncular", names: ["Lara Güven", "Arda Sezer"] },
    ],
    originalTitle: null,
    runtimeMinutes: 96,
    subtitleLanguages: [],
    synopsis:
      "Yönünü göstermeyen eski bir pusula, kardeşleri çocukluklarında yarım bıraktıkları rotaya döndürür.",
  },
  "kiyidaki-sessizlik": {
    ageRating: null,
    credits: [
      { label: "Yönetmen", names: ["Pelin Somer"] },
      { label: "Oyuncular", names: ["Ece Derman", "Koray Aksu"] },
    ],
    originalTitle: null,
    runtimeMinutes: 98,
    subtitleLanguages: ["Türkçe"],
    synopsis:
      "Sessiz bir kıyı kasabasına dönen bir ses kayıtçısı, yıllardır duyulmayan bir deniz feneri sinyalini araştırır.",
  },
  "ruzgarin-unuttugu-sehrin-uzun-gecesi": {
    ageRating: "13+",
    credits: [
      { label: "Yönetmen", names: ["Suna Beril"] },
      { label: "Senaryo", names: ["Kerem Önal"] },
    ],
    originalTitle: "The Long Night of the City the Wind Forgot",
    runtimeMinutes: 123,
    subtitleLanguages: ["Türkçe", "İngilizce", "Almanca"],
    synopsis:
      "Rüzgârın yıllardır esmediği bir şehirde gece bekçisi, saatlerin aynı dakikada durduğunu fark eder.",
  },
  "sonbahar-provasi": {
    ageRating: "7+",
    credits: [
      { label: "Yönetmen", names: ["Cemre Ulu"] },
      { label: "Oyuncular", names: ["Ada Işın", "Umut Er"] },
    ],
    originalTitle: null,
    runtimeMinutes: 101,
    subtitleLanguages: ["Türkçe"],
    synopsis:
      "Kapanmak üzere olan bir tiyatronun son provası, eski oyuncuları yıllar sonra aynı sahnede buluşturur.",
  },
  "yarin-kalanlar": {
    ageRating: "13+",
    credits: [
      { label: "Yönetmen", names: ["Eren Sarp"] },
      { label: "Oyuncular", names: ["Nisan Gün", "Berk Ay"] },
    ],
    originalTitle: null,
    runtimeMinutes: 108,
    subtitleLanguages: ["Türkçe", "İngilizce"],
    synopsis:
      "Bir araştırma ekibi, ertesi güne ait ses kayıtları almaya başladığında hangi geleceği koruyacağına karar verir.",
  },
  "sessiz-frekans": {
    ageRating: "13+",
    credits: [
      { label: "Yönetmen", names: ["İdil Sarı"] },
      { label: "Oyuncular", names: ["Ekin Irmak", "Sarp Elçi"] },
    ],
    originalTitle: null,
    runtimeMinutes: 99,
    subtitleLanguages: ["Türkçe"],
    synopsis:
      "Bir radyo teknisyeni, yayın yapılmayan bir frekansta yıllar öncesinden gelen konuşmaları duyar.",
  },
  "tasra-atlasi": {
    ageRating: "7+",
    credits: [{ label: "Yönetmen", names: ["Arın Demir"] }],
    originalTitle: null,
    runtimeMinutes: 89,
    subtitleLanguages: [],
    synopsis:
      "İki kardeş, dedelerinden kalan çizimsiz atlasın sayfalarını tamamlamak için Anadolu yollarına çıkar.",
  },
};

function toCard(movie: FixtureMovie): MovieCardView {
  return {
    id: movie.id,
    poster: movie.poster,
    rating: movie.rating,
    slug: movie.slug,
    title: movie.title,
    year: movie.year,
  };
}

function matchesSearch(movie: FixtureMovie, query: string): boolean {
  const extras = detailExtras[movie.slug];
  const normalizedQuery = query.toLocaleLowerCase("tr-TR");
  const searchable = [
    movie.title,
    extras?.originalTitle ?? "",
    ...(extras?.credits.flatMap((group) => group.names) ?? []),
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return searchable.includes(normalizedQuery);
}

const page: HomePageView = {
  featured: {
    ...toCard(movies.coast),
    ageRating: null,
    backdrop: catalogImages.fogCoast,
    genres: ["Dram", "Gizem"],
    runtimeMinutes: 98,
    synopsis:
      "Sessiz bir kıyı kasabasına dönen bir ses kayıtçısı, yıllardır duyulmayan bir deniz feneri sinyalini araştırır.",
  },
  rails: [
    {
      id: "editorial",
      movies: [
        movies.station,
        movies.coast,
        movies.map,
        movies.rehearsal,
        movies.wind,
        movies.tomorrow,
        movies.compass,
        movies.shift,
        movies.frequency,
        movies.atlas,
      ].map(toCard),
      title: "Editörün seçkisi",
      variant: "standard",
      viewAllHref: "/filmler?siralama=editor-secimi",
    },
    {
      id: "new",
      movies: [
        movies.tomorrow,
        movies.station,
        movies.wind,
        movies.coast,
        movies.map,
        movies.rehearsal,
        movies.compass,
        movies.shift,
        movies.frequency,
        movies.atlas,
      ].map(toCard),
      title: "Yeni eklenenler",
      variant: "standard",
      viewAllHref: "/filmler?siralama=yeni",
    },
    {
      id: "popular",
      movies: [
        movies.station,
        movies.rehearsal,
        movies.coast,
        movies.map,
        movies.tomorrow,
        movies.wind,
        movies.compass,
        movies.shift,
        movies.frequency,
        movies.atlas,
      ].map(toCard),
      title: "İlk on",
      variant: "ranked",
      viewAllHref: "/filmler?siralama=populer",
    },
    {
      id: "empty-editorial-slot",
      movies: [],
      title: "Yakında",
      variant: "standard",
      viewAllHref: null,
    },
  ],
};

export const fixtureCatalogQuery: CatalogQueryPort = {
  getHomePage: async () => page,
  getMovieBySlug: async (slug: string): Promise<MovieDetailView | null> => {
    const movie = allMovies.find((candidate) => candidate.slug === slug);
    const extras = detailExtras[slug];

    if (movie === undefined || extras === undefined) {
      return null;
    }

    const genres = genreOptions
      .filter((genre) => movie.genreSlugs.includes(genre.slug))
      .map((genre) => genre.name);
    const similarMovies = allMovies
      .filter(
        (candidate) =>
          candidate.id !== movie.id &&
          candidate.genreSlugs.some((genre) => movie.genreSlugs.includes(genre)),
      )
      .sort((left, right) => left.editorialRank - right.editorialRank)
      .slice(0, 5)
      .map(toCard);

    return {
      ...toCard(movie),
      ageRating: extras.ageRating,
      backdrop: movie.poster,
      credits: extras.credits,
      genres,
      isPlayable: false,
      originalTitle: extras.originalTitle,
      runtimeMinutes: extras.runtimeMinutes,
      similarMovies,
      subtitleLanguages: extras.subtitleLanguages,
      synopsis: extras.synopsis,
    };
  },
  listMovies: async (filters: CatalogFilters): Promise<CatalogPageView> => {
    const filtered = allMovies.filter(
      (movie) =>
        (filters.genre === null || movie.genreSlugs.includes(filters.genre)) &&
        (filters.year === null || movie.year === filters.year),
    );
    const sorted = [...filtered].sort((left, right) => {
      switch (filters.sort) {
        case "yeni":
          return right.addedOrder - left.addedOrder;
        case "populer":
          return right.popularity - left.popularity;
        case "puan":
          return (right.rating?.average ?? 0) - (left.rating?.average ?? 0);
        case "editor-secimi":
          return left.editorialRank - right.editorialRank;
      }
    });

    return {
      availableGenres: genreOptions,
      availableYears: [...new Set(allMovies.map((movie) => movie.year))].sort(
        (left, right) => right - left,
      ),
      movies: sorted.map(toCard),
      total: sorted.length,
    };
  },
  searchMovies: async (query: string): Promise<SearchPageView> => {
    const results = allMovies.filter((movie) => matchesSearch(movie, query)).map(toCard);
    return { movies: results, total: results.length };
  },
  suggestMovies: async (query: string, limit: number): Promise<readonly SearchSuggestion[]> =>
    allMovies
      .filter((movie) => matchesSearch(movie, query))
      .slice(0, limit)
      .map((movie) => ({
        id: movie.id,
        kind: "movie",
        poster: movie.poster,
        slug: movie.slug,
        title: movie.title,
        year: movie.year,
      })),
};
