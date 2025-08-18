"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const getCitiesByCountry = action({
  args: { country: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args): Promise<string[]> => {
    try {
      // For now, use fallback data directly since the API is having issues
      // This ensures reliable functionality while we resolve API issues
      const cities = getFallbackCities(args.country);
      
      // If we have cities in fallback data, return them
      if (cities.length > 0) {
        return cities;
      }
      
      // If no fallback data, try API as last resort
      const apiKey = process.env.GEO_DB_API_KEY || "demo";
      const encodedCountry = encodeURIComponent(args.country);
      const url = `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?countryIds=${encodedCountry}&limit=1000&sort=-population`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        console.error(`API request failed: ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        const cities = data.data
          .map((city: any) => city.city)
          .filter((city: string) => city && city.trim() !== '')
          .sort();
        
        return cities;
      } else {
        console.error('Invalid API response format');
        return [];
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  },
});

// Fallback function with comprehensive city data
function getFallbackCities(country: string): string[] {
  const cityData: Record<string, string[]> = {
    "Pakistan": [
      "Abbottabad", "Adda", "Ahmadpur East", "Ahmadpur Sial", "Alipur", "Arifwala", "Attock", "Badin", "Bahawalnagar", "Bahawalpur", 
      "Bannu", "Bhakkar", "Bhalwal", "Burewala", "Chakwal", "Chaman", "Charsadda", "Chiniot", "Chishtian", "Dadu", "Daska", "Dera Ghazi Khan", 
      "Dera Ismail Khan", "Dera Murad Jamali", "Dera Bugti", "Dera Allah Yar", "Dera Nawab Sahib", "Faisalabad", "Fateh Jang", "Ghotki", "Gojra", "Gujranwala", 
      "Gujrat", "Gwadar", "Hafizabad", "Haripur", "Haroonabad", "Hasilpur", "Havelian", "Haveli Lakha", "Hazro", "Hub", "Hyderabad", 
      "Islamabad", "Jacobabad", "Jahanian", "Jalalpur Jattan", "Jampur", "Jaranwala", "Jatoi", "Jauharabad", "Jhang", "Jhelum", "Kāmoke", 
      "Kandhkot", "Kandiaro", "Karachi", "Karak", "Kasur", "Khanewal", "Khanpur", "Kharian", "Khushab", "Khuzdar", "Kohat", "Kot Addu", 
      "Kotri", "Lahore", "Lakki Marwat", "Larkana", "Layyah", "Lodhran", "Mandi Bahauddin", "Mardan", "Matiari", "Mian Channu", "Mianwali", 
      "Mingora", "Mirpur Khas", "Mirpur", "Multan", "Muridke", "Murree", "Muzaffarabad", "Muzaffargarh", "Nankana Sahib", "Narowal", 
      "Naushahro Feroze", "Nawabshah", "Nowshera", "Okara", "Pakpattan", "Peshawar", "Pind Dadan Khan", "Pindi Bhattian", "Pindi Gheb", 
      "Pir Mahal", "Quetta", "Rahim Yar Khan", "Rajanpur", "Rawalpindi", "Sadiqabad", "Sahiwal", "Sambrial", "Sanghar", "Sargodha", 
      "Shahdadkot", "Shahdadpur", "Sheikhupura", "Shikarpur", "Sialkot", "Sibi", "Sukkur", "Swabi", "Tando Adam", "Tando Allahyar", 
      "Toba Tek Singh", "Turbat", "Umerkot", "Vehari", "Wah Cantonment", "Wazirabad", "Yazman", "Zafarwal", "Zahir Pir"
    ],
    "United Kingdom": [
      "Aberdeen", "Aberystwyth", "Bath", "Belfast", "Birmingham", "Blackpool", "Bournemouth", "Bradford", "Brighton", "Bristol", 
      "Cambridge", "Cardiff", "Carlisle", "Chelmsford", "Chester", "Coventry", "Derby", "Dundee", "Durham", "Edinburgh", "Exeter", 
      "Glasgow", "Gloucester", "Hull", "Leeds", "Leicester", "Liverpool", "London", "Manchester", "Middlesbrough", "Newcastle", 
      "Newport", "Norwich", "Nottingham", "Oxford", "Plymouth", "Portsmouth", "Preston", "Reading", "Sheffield", "Southampton", 
      "Stoke-on-Trent", "Sunderland", "Swansea", "Wakefield", "Wolverhampton", "York"
    ],
    "United States": [
      "Albuquerque", "Anaheim", "Anchorage", "Arlington", "Atlanta", "Austin", "Baltimore", "Birmingham", "Boston", "Buffalo", 
      "Charlotte", "Chicago", "Cincinnati", "Cleveland", "Colorado Springs", "Columbus", "Dallas", "Denver", "Detroit", "El Paso", 
      "Fort Worth", "Fresno", "Houston", "Indianapolis", "Jacksonville", "Kansas City", "Las Vegas", "Long Beach", "Los Angeles", 
      "Louisville", "Memphis", "Mesa", "Miami", "Milwaukee", "Minneapolis", "Nashville", "New Orleans", "New York", "Oakland", 
      "Oklahoma City", "Omaha", "Orlando", "Philadelphia", "Phoenix", "Pittsburgh", "Portland", "Raleigh", "Sacramento", "San Antonio", 
      "San Diego", "San Francisco", "San Jose", "Seattle", "St. Louis", "Tampa", "Tucson", "Tulsa", "Virginia Beach", "Washington"
    ],
    "Canada": [
      "Calgary", "Edmonton", "Halifax", "Hamilton", "Kitchener", "London", "Mississauga", "Montreal", "Ottawa", "Quebec City", 
      "Regina", "Saskatoon", "Toronto", "Vancouver", "Victoria", "Winnipeg"
    ],
    "Australia": [
      "Adelaide", "Brisbane", "Canberra", "Darwin", "Gold Coast", "Hobart", "Melbourne", "Newcastle", "Perth", "Sydney", 
      "Sunshine Coast", "Wollongong"
    ],
    "Germany": [
      "Berlin", "Bremen", "Cologne", "Dortmund", "Dresden", "Düsseldorf", "Essen", "Frankfurt", "Hamburg", "Hannover", 
      "Leipzig", "Munich", "Nuremberg", "Stuttgart"
    ],
    "France": [
      "Bordeaux", "Lille", "Lyon", "Marseille", "Montpellier", "Nantes", "Nice", "Paris", "Strasbourg", "Toulouse"
    ],
    "India": [
      "Ahmedabad", "Bangalore", "Chennai", "Delhi", "Hyderabad", "Jaipur", "Kolkata", "Mumbai", "Pune", "Surat"
    ],
    "China": [
      "Beijing", "Chengdu", "Chongqing", "Guangzhou", "Nanjing", "Shanghai", "Shenzhen", "Tianjin", "Wuhan", "Xi'an"
    ],
    "Japan": [
      "Fukuoka", "Kawasaki", "Kobe", "Kyoto", "Nagoya", "Osaka", "Saitama", "Sapporo", "Tokyo", "Yokohama"
    ],
    // Additional countries with major cities
    "Afghanistan": ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif", "Jalalabad", "Kunduz", "Ghazni", "Balkh", "Baghlan", "Gardez"],
    "Albania": ["Tirana", "Durrës", "Vlorë", "Elbasan", "Shkodër", "Fier", "Korçë", "Berat", "Lushnjë", "Pogradec"],
    "Algeria": ["Algiers", "Oran", "Constantine", "Annaba", "Batna", "Blida", "Setif", "Chlef", "Djelfa", "Sétif"],
    "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "San Miguel de Tucumán", "Mar del Plata", "Salta", "Santa Fe", "San Juan"],
    "Armenia": ["Yerevan", "Gyumri", "Vanadzor", "Vagharshapat", "Abovyan", "Kapan", "Hrazdan", "Ijevan", "Gavar", "Armavir"],
    "Austria": ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels", "Sankt Pölten", "Dornbirn"],
    "Azerbaijan": ["Baku", "Ganja", "Sumqayit", "Mingachevir", "Lankaran", "Shirvan", "Nakhchivan", "Shaki", "Yevlakh", "Qazax"],
    "Bahrain": ["Manama", "Muharraq", "Riffa", "Hamad Town", "A'ali", "Isa Town", "Sitra", "Budaiya", "Jidhafs", "Al-Malikiyah"],
    "Bangladesh": ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Barisal", "Sylhet", "Rangpur", "Mymensingh", "Comilla", "Narayanganj"],
    "Belarus": ["Minsk", "Gomel", "Mogilev", "Vitebsk", "Grodno", "Brest", "Babruysk", "Baranovichi", "Borisov", "Pinsk"],
    "Belgium": ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Namur", "Leuven", "Mons", "Aalst"],
    "Brazil": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre"],
    "Bulgaria": ["Sofia", "Plovdiv", "Varna", "Burgas", "Ruse", "Stara Zagora", "Pleven", "Sliven", "Dobrich", "Shumen"],
    "Cambodia": ["Phnom Penh", "Battambang", "Siem Reap", "Sihanoukville", "Kampong Cham", "Kampong Thom", "Kampot", "Kratie", "Takeo", "Kampong Speu"],
    "Chile": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Viña del Mar", "Temuco", "Puerto Montt", "Iquique", "Coquimbo"],
    "Colombia": ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Cúcuta", "Bucaramanga", "Pereira", "Santa Marta", "Ibagué"],
    "Croatia": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varaždin", "Šibenik"],
    "Czech Republic": ["Prague", "Brno", "Ostrava", "Plzen", "Liberec", "Olomouc", "Ústí nad Labem", "České Budějovice", "Hradec Králové", "Pardubice"],
    "Denmark": ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde"],
    "Egypt": ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said", "Suez", "Luxor", "Mansoura", "El-Mahalla El-Kubra", "Aswan"],
    "Estonia": ["Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve", "Viljandi", "Rakvere", "Maardu", "Kuressaare", "Sillamäe"],
    "Finland": ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti", "Kuopio", "Pori"],
    "Greece": ["Athens", "Thessaloniki", "Patras", "Piraeus", "Larissa", "Heraklion", "Peristeri", "Kallithea", "Acharnes", "Kalamaria"],
    "Hungary": ["Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely"],
    "Indonesia": ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Palembang", "Makassar", "Tangerang", "Depok", "Bekasi"],
    "Iran": ["Tehran", "Mashhad", "Isfahan", "Tabriz", "Shiraz", "Kerman", "Yazd", "Qom", "Kermanshah", "Urmia"],
    "Iraq": ["Baghdad", "Basra", "Mosul", "Erbil", "Sulaymaniyah", "Najaf", "Karbala", "Kirkuk", "Nasiriyah", "Amara"],
    "Ireland": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Bray", "Navan"],
    "Israel": ["Jerusalem", "Tel Aviv", "Haifa", "Rishon LeZion", "Petah Tikva", "Ashdod", "Netanya", "Beer Sheva", "Holon", "Bnei Brak"],
    "Italy": ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Bari", "Catania"],
    "Jordan": ["Amman", "Zarqa", "Irbid", "Russeifa", "Al-Quwaysimah", "Tila al-Ali", "Wadi al-Seer", "Jubeiha", "Khuraybat as-Suq", "Sahab"],
    "Kazakhstan": ["Almaty", "Nur-Sultan", "Shymkent", "Aktobe", "Karaganda", "Taraz", "Pavlodar", "Oskemen", "Semey", "Atyrau"],
    "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Nyeri", "Machakos", "Kakamega", "Kisii", "Thika"],
    "Kuwait": ["Kuwait City", "Salmiya", "Hawalli", "Jahra", "Fahaheel", "Kuwait City", "Salmiya", "Hawalli", "Jahra", "Fahaheel"],
    "Lebanon": ["Beirut", "Tripoli", "Sidon", "Tyre", "Nabatieh", "Zahle", "Baalbek", "Jounieh", "Byblos", "Batroun"],
    "Malaysia": ["Kuala Lumpur", "George Town", "Ipoh", "Shah Alam", "Petaling Jaya", "Johor Bahru", "Malacca City", "Alor Setar", "Miri", "Kuching"],
    "Mexico": ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "Ciudad Juárez", "León", "Zapopan", "Nezahualcóyotl", "Guadalupe"],
    "Morocco": ["Casablanca", "Rabat", "Fez", "Marrakech", "Agadir", "Tangier", "Meknes", "Oujda", "Kénitra", "Tetouan"],
    "Netherlands": ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Tilburg", "Groningen", "Almere", "Breda", "Nijmegen"],
    "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Napier-Hastings", "Dunedin", "Palmerston North", "Nelson", "Rotorua"],
    "Nigeria": ["Lagos", "Kano", "Ibadan", "Kaduna", "Port Harcourt", "Benin City", "Maiduguri", "Zaria", "Aba", "Jos"],
    "Norway": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand", "Sandnes", "Tromsø", "Sarpsborg"],
    "Philippines": ["Manila", "Quezon City", "Davao City", "Caloocan", "Cebu City", "Zamboanga City", "Antipolo", "Pasig", "Taguig", "Valenzuela"],
    "Poland": ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Katowice"],
    "Portugal": ["Lisbon", "Porto", "Vila Nova de Gaia", "Amadora", "Braga", "Funchal", "Coimbra", "Setúbal", "Almada", "Agualva-Cacém"],
    "Qatar": ["Doha", "Al Wakrah", "Al Khor", "Lusail", "Al Rayyan", "Umm Salal", "Al Daayen", "Al Shamal", "Al Gharafa", "Al Sadd"],
    "Romania": ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Galați", "Ploiești", "Brașov", "Brăila"],
    "Russia": ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod", "Chelyabinsk", "Samara", "Omsk", "Rostov-on-Don"],
    "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Taif", "Tabuk", "Buraidah", "Khamis Mushait", "Al-Ahsa"],
    "Serbia": ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Zrenjanin", "Pančevo", "Čačak", "Kraljevo", "Novi Pazar"],
    "Singapore": ["Singapore"],
    "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Nelspruit", "Kimberley", "Polokwane"],
    "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Changwon", "Seongnam"],
    "Spain": ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Murcia", "Palma", "Las Palmas", "Bilbao"],
    "Sri Lanka": ["Colombo", "Dehiwala-Mount Lavinia", "Moratuwa", "Negombo", "Kotte", "Batticaloa", "Jaffna", "Galle", "Trincomalee", "Kandy"],
    "Sweden": ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping", "Helsingborg", "Jönköping", "Norrköping"],
    "Switzerland": ["Zurich", "Geneva", "Basel", "Bern", "Lausanne", "Winterthur", "St. Gallen", "Lucerne", "Lugano", "Biel"],
    "Thailand": ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Hat Yai", "Nakhon Ratchasima", "Udon Thani", "Khon Kaen", "Nakhon Si Thammarat", "Chiang Rai"],
    "Turkey": ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Gaziantep", "Konya", "Mersin", "Diyarbakır"],
    "Ukraine": ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Donetsk", "Zaporizhzhia", "Lviv", "Kryvyi Rih", "Mykolaiv", "Mariupol"],
    "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Khor Fakkan", "Dibba Al-Fujairah"],
    "Uruguay": ["Montevideo", "Salto", "Ciudad de la Costa", "Paysandú", "Las Piedras", "Rivera", "Maldonado", "Tacuarembó", "Melo", "Mercedes"],
    "Venezuela": ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay", "Petare", "Ciudad Guayana", "Maturín", "Barcelona", "Turmero"],
    "Vietnam": ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho", "Bien Hoa", "Hue", "Nha Trang", "Buon Ma Thuot", "Vung Tau"]
  };

  return cityData[country] || [];
}
