#!/usr/bin/env node
/**
 * UK Area Data Generator
 * Writes config/areas/{city}.json for every major UK city/town.
 * Run: node scripts/generate-uk-areas.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../config/areas");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// City definitions
// Each entry: { primaryCity, coreAreas[], priorityAreas[], areaProfiles{} }
// ─────────────────────────────────────────────────────────────────────────────

const CITIES = [

  // ── ENGLAND ────────────────────────────────────────────────────────────────

  {
    primaryCity: "London",
    coreAreas: ["Hackney","Islington","Camden","Southwark","Lambeth","Wandsworth","Hammersmith","Fulham","Kensington","Chelsea","Tower Hamlets","Lewisham","Greenwich","Bromley","Croydon","Richmond"],
    priorityAreas: ["Camden","Islington","Hackney","Southwark","Kensington"],
    areaProfiles: {
      "Hackney":      { character: "vibrant creative east London borough", knownFor: "tech startups, creative agencies and independent retailers", businessType: "creative, digital and independent businesses" },
      "Islington":    { character: "affluent urban borough with strong professional base", knownFor: "boutique retail, restaurants and professional services", businessType: "professional services and premium lifestyle businesses" },
      "Camden":       { character: "iconic cultural and commercial London borough", knownFor: "entertainment, independent retail and a diverse business community", businessType: "retail, hospitality and creative industry businesses" },
      "Southwark":    { character: "diverse central London borough undergoing rapid regeneration", knownFor: "hospitality, professional services and growing tech presence", businessType: "professional services, hospitality and tech businesses" },
      "Lambeth":      { character: "energetic south London borough with strong community identity", knownFor: "independent businesses, arts venues and a diverse commercial base", businessType: "community-focused and independent businesses" },
      "Wandsworth":   { character: "prosperous south-west London borough", knownFor: "high-value residential, local retail and professional services", businessType: "premium service businesses and independent retailers" },
      "Hammersmith":  { character: "well-connected west London commercial hub", knownFor: "professional services, media companies and retail", businessType: "corporate, media and service businesses" },
      "Fulham":       { character: "affluent residential area in west London", knownFor: "high-end retail, restaurants and personal services", businessType: "premium and lifestyle-focused businesses" },
      "Kensington":   { character: "prestigious central London district", knownFor: "luxury retail, international businesses and premium services", businessType: "luxury and high-end professional businesses" },
      "Chelsea":      { character: "exclusive and fashionable central London area", knownFor: "designer retail, luxury hospitality and premium services", businessType: "luxury retail, fashion and premium service businesses" },
      "Tower Hamlets":{ character: "rapidly developing east London borough", knownFor: "tech and finance businesses, diverse community and growing retail", businessType: "tech, finance and entrepreneurial businesses" },
      "Lewisham":     { character: "diverse and regenerating south-east London borough", knownFor: "community businesses, independent retail and growing services", businessType: "community-led and independent businesses" },
      "Greenwich":    { character: "heritage-rich south-east London borough", knownFor: "tourism, local services and a growing residential base", businessType: "hospitality, retail and service businesses" },
      "Bromley":      { character: "prosperous outer south-east London borough", knownFor: "suburban retail, professional services and family businesses", businessType: "suburban service and retail businesses" },
      "Croydon":      { character: "major outer London commercial and retail centre", knownFor: "retail, professional services and a large business community", businessType: "retail, professional and service businesses" },
      "Richmond":     { character: "affluent outer south-west London district", knownFor: "premium retail, professional services and outdoor lifestyle businesses", businessType: "premium and lifestyle service businesses" },
    }
  },

  {
    primaryCity: "Birmingham",
    coreAreas: ["Solihull","Sutton Coldfield","Edgbaston","Moseley","Kings Heath","Harborne","Erdington","Handsworth","Bournville","Selly Oak","Acocks Green","Hall Green","Sheldon","Northfield","Stirchley"],
    priorityAreas: ["Solihull","Sutton Coldfield","Edgbaston","Harborne","Moseley"],
    areaProfiles: {
      "Solihull":       { character: "affluent suburban town south-east of Birmingham", knownFor: "premium retail, professional services and business parks", businessType: "professional and premium service businesses" },
      "Sutton Coldfield":{ character: "prosperous northern suburb of Birmingham", knownFor: "established retailers, professional services and family businesses", businessType: "professional and family service businesses" },
      "Edgbaston":      { character: "prestigious residential and professional district", knownFor: "medical and legal services, private education and high-end businesses", businessType: "professional, medical and premium service businesses" },
      "Moseley":        { character: "bohemian village-style suburb", knownFor: "independent cafés, boutique retailers and creative businesses", businessType: "independent and creative businesses" },
      "Kings Heath":    { character: "lively suburban high street community", knownFor: "independent retail, restaurants and local service businesses", businessType: "independent retail and service businesses" },
      "Harborne":       { character: "well-regarded suburban village area", knownFor: "boutique retail, restaurants and professional services", businessType: "premium and lifestyle service businesses" },
      "Erdington":      { character: "large residential suburb to the north", knownFor: "everyday retail, trades and community service businesses", businessType: "trades, retail and community businesses" },
      "Handsworth":     { character: "diverse urban area with rich cultural heritage", knownFor: "diverse community businesses, retail and independent traders", businessType: "diverse community and independent businesses" },
      "Bournville":     { character: "distinctive planned residential suburb", knownFor: "community businesses, local services and family-oriented traders", businessType: "community-focused businesses" },
      "Selly Oak":      { character: "student and academic area near the university", knownFor: "student services, independent retail and budget-friendly businesses", businessType: "student-focused and independent businesses" },
      "Acocks Green":   { character: "busy south-east suburban district", knownFor: "local retail, trades and community service providers", businessType: "community service and retail businesses" },
      "Hall Green":     { character: "established south-east residential suburb", knownFor: "family services, local retail and independent businesses", businessType: "family and community service businesses" },
      "Sheldon":        { character: "suburban area near Birmingham Airport", knownFor: "local services, retail and transport-linked businesses", businessType: "service and logistics businesses" },
      "Northfield":     { character: "established south-west suburban centre", knownFor: "high-street retail, trades and everyday services", businessType: "retail, trades and service businesses" },
      "Stirchley":      { character: "regenerating south suburb with indie culture", knownFor: "independent eateries, craft businesses and creative enterprises", businessType: "independent and creative businesses" },
    }
  },

  {
    primaryCity: "Manchester",
    coreAreas: ["Didsbury","Chorlton","Sale","Salford","Stretford","Altrincham","Withington","Levenshulme","Fallowfield","Stockport","Wythenshawe","Gorton","Longsight","Rusholme","Ancoats"],
    priorityAreas: ["Didsbury","Altrincham","Chorlton","Sale","Ancoats"],
    areaProfiles: {
      "Didsbury":     { character: "prosperous south Manchester suburb", knownFor: "boutique retail, independent restaurants and professional services", businessType: "premium and lifestyle service businesses" },
      "Chorlton":     { character: "vibrant, progressive south Manchester community", knownFor: "independent businesses, cafés and creative services", businessType: "independent and creative businesses" },
      "Sale":         { character: "well-connected Trafford commuter town", knownFor: "suburban retail, professional services and family businesses", businessType: "professional and family service businesses" },
      "Salford":      { character: "regenerating city with strong media presence", knownFor: "media, tech and creative industry businesses", businessType: "media, creative and professional businesses" },
      "Stretford":    { character: "busy urban area with growing independent scene", knownFor: "community businesses, retail and local services", businessType: "community and retail businesses" },
      "Altrincham":   { character: "thriving market town west of Manchester", knownFor: "award-winning market, premium retail and professional services", businessType: "premium retail and professional service businesses" },
      "Withington":   { character: "mixed student and professional suburban area", knownFor: "independent eateries, student services and community businesses", businessType: "independent and student-focused businesses" },
      "Levenshulme":  { character: "diverse, creative south Manchester community", knownFor: "antiques, independent markets and community-led businesses", businessType: "independent and community businesses" },
      "Fallowfield":  { character: "large student area close to universities", knownFor: "student-oriented retail, food and lifestyle businesses", businessType: "student-facing and independent businesses" },
      "Stockport":    { character: "large Greater Manchester town with strong identity", knownFor: "retail, professional services and trades businesses", businessType: "retail, trades and service businesses" },
      "Wythenshawe":  { character: "large south Manchester residential area", knownFor: "community services, everyday retail and local trades", businessType: "community and trades businesses" },
      "Gorton":       { character: "east Manchester residential community", knownFor: "community services, local trades and neighbourhood businesses", businessType: "community and service businesses" },
      "Longsight":    { character: "diverse multicultural urban area", knownFor: "diverse community businesses, independent traders and food businesses", businessType: "diverse community and independent businesses" },
      "Rusholme":     { character: "famous curry mile and multicultural hub", knownFor: "diverse restaurants, food businesses and community retail", businessType: "hospitality and community businesses" },
      "Ancoats":      { character: "trendy regenerated inner-city neighbourhood", knownFor: "independent restaurants, creative studios and professional services", businessType: "creative, hospitality and professional businesses" },
    }
  },

  {
    primaryCity: "Leeds",
    coreAreas: ["Headingley","Chapel Allerton","Meanwood","Roundhay","Moortown","Horsforth","Otley","Wetherby","Morley","Pudsey","Garforth","Guiseley","Kirkstall","Hyde Park","Seacroft"],
    priorityAreas: ["Headingley","Chapel Allerton","Roundhay","Horsforth","Meanwood"],
    areaProfiles: {
      "Headingley":      { character: "vibrant student and professional suburb", knownFor: "independent bars, eateries and lifestyle businesses", businessType: "hospitality, independent and lifestyle businesses" },
      "Chapel Allerton": { character: "trendy north Leeds village suburb", knownFor: "independent restaurants, boutiques and creative businesses", businessType: "independent and creative businesses" },
      "Meanwood":        { character: "popular residential area with village feel", knownFor: "independent cafés, local retail and community services", businessType: "independent and community businesses" },
      "Roundhay":        { character: "affluent north Leeds residential suburb", knownFor: "premium retail, professional services and family businesses", businessType: "premium and professional service businesses" },
      "Moortown":        { character: "established north Leeds suburb", knownFor: "local retail, professional services and community businesses", businessType: "professional and community service businesses" },
      "Horsforth":       { character: "popular commuter village north-west of Leeds", knownFor: "independent retail, restaurants and local services", businessType: "independent and family service businesses" },
      "Otley":           { character: "historic market town in the Wharfe Valley", knownFor: "independent retail, trades and community businesses", businessType: "independent and community businesses" },
      "Wetherby":        { character: "prosperous market town east of Harrogate", knownFor: "premium retail, professional services and quality traders", businessType: "professional and premium service businesses" },
      "Morley":          { character: "busy market town south-west of Leeds", knownFor: "retail, trades and everyday service businesses", businessType: "retail, trades and service businesses" },
      "Pudsey":          { character: "large west Leeds suburban town", knownFor: "community retail, trades and local service providers", businessType: "trades, community and service businesses" },
      "Garforth":        { character: "well-connected east Leeds commuter suburb", knownFor: "local services, retail and family-oriented businesses", businessType: "family and community service businesses" },
      "Guiseley":        { character: "suburban town between Leeds and Bradford", knownFor: "local retail, trades and commuter services", businessType: "community and service businesses" },
      "Kirkstall":       { character: "historic west Leeds riverside area", knownFor: "independent businesses, retail parks and community services", businessType: "community and independent businesses" },
      "Hyde Park":       { character: "large student area close to Leeds universities", knownFor: "student services, independent retail and takeaway businesses", businessType: "student-facing and independent businesses" },
      "Seacroft":        { character: "large east Leeds residential area", knownFor: "community services, everyday retail and local trades", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Liverpool",
    coreAreas: ["Aigburth","Allerton","Childwall","Crosby","Formby","Garston","Huyton","Maghull","Mossley Hill","Norris Green","Sefton Park","Speke","Wavertree","West Derby","Woolton"],
    priorityAreas: ["Crosby","Formby","Woolton","Mossley Hill","Allerton"],
    areaProfiles: {
      "Aigburth":    { character: "popular south Liverpool residential suburb", knownFor: "independent eateries, local retail and community services", businessType: "independent and community businesses" },
      "Allerton":    { character: "established south Liverpool suburb", knownFor: "local retail, professional services and community businesses", businessType: "professional and community service businesses" },
      "Childwall":   { character: "affluent south Liverpool residential area", knownFor: "professional services, quality retailers and family businesses", businessType: "professional and family service businesses" },
      "Crosby":      { character: "well-regarded coastal suburb north of Liverpool", knownFor: "independent retail, professional services and community businesses", businessType: "professional and independent businesses" },
      "Formby":      { character: "affluent coastal town north of Liverpool", knownFor: "premium retail, professional services and lifestyle businesses", businessType: "premium and lifestyle service businesses" },
      "Garston":     { character: "south Liverpool area with strong community identity", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Huyton":      { character: "large east Liverpool district", knownFor: "community services, everyday retail and local trades", businessType: "community, retail and trades businesses" },
      "Maghull":     { character: "suburban town north of Liverpool", knownFor: "local retail, family services and community businesses", businessType: "family and community businesses" },
      "Mossley Hill": { character: "quiet south Liverpool residential area", knownFor: "professional services, local retail and quality trades", businessType: "professional and quality service businesses" },
      "Norris Green": { character: "north Liverpool residential community", knownFor: "community services, local trades and everyday businesses", businessType: "community and service businesses" },
      "Sefton Park":  { character: "prestigious Victorian park district", knownFor: "boutique businesses, independent retailers and lifestyle services", businessType: "lifestyle and independent businesses" },
      "Speke":        { character: "south Liverpool area near the airport", knownFor: "trade and industrial businesses, local services", businessType: "trade and service businesses" },
      "Wavertree":    { character: "central residential suburb with tech village links", knownFor: "tech, digital and community businesses", businessType: "tech, digital and community businesses" },
      "West Derby":   { character: "established north Liverpool suburb", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Woolton":      { character: "picturesque village suburb in south Liverpool", knownFor: "independent retail, premium services and boutique businesses", businessType: "premium and independent businesses" },
    }
  },

  {
    primaryCity: "Newcastle",
    coreAreas: ["Jesmond","Gosforth","Heaton","Fenham","Byker","Gateshead","Whitley Bay","Tynemouth","North Shields","South Shields","Wallsend","Benton","Longbenton","Ponteland","Cramlington"],
    priorityAreas: ["Jesmond","Gosforth","Tynemouth","Whitley Bay","Ponteland"],
    areaProfiles: {
      "Jesmond":      { character: "affluent urban village close to the city centre", knownFor: "independent eateries, boutique retail and professional services", businessType: "independent and professional service businesses" },
      "Gosforth":     { character: "prosperous north Newcastle suburb", knownFor: "local retail, professional services and quality independent businesses", businessType: "professional and independent businesses" },
      "Heaton":       { character: "popular student and young professional area", knownFor: "independent cafés, community services and budget retail", businessType: "community and independent businesses" },
      "Fenham":       { character: "diverse west Newcastle residential area", knownFor: "community services, diverse retail and local trades", businessType: "community and trades businesses" },
      "Byker":        { character: "distinctive east Newcastle community", knownFor: "community-led businesses, local services and independent traders", businessType: "community and independent businesses" },
      "Gateshead":    { character: "major south Tyne commercial and retail centre", knownFor: "retail parks, professional services and diverse businesses", businessType: "retail, professional and service businesses" },
      "Whitley Bay":  { character: "coastal town east of Newcastle", knownFor: "seaside businesses, independent retail and lifestyle services", businessType: "lifestyle, tourism and independent businesses" },
      "Tynemouth":    { character: "prestigious coastal village suburb", knownFor: "premium retail, independent restaurants and lifestyle businesses", businessType: "premium and lifestyle businesses" },
      "North Shields":{ character: "riverside town with fish quay and market", knownFor: "seafood, independent traders and community businesses", businessType: "community and independent businesses" },
      "South Shields":{ character: "coastal town at the mouth of the Tyne", knownFor: "tourism, seaside businesses and community services", businessType: "tourism, hospitality and community businesses" },
      "Wallsend":     { character: "east Newcastle town with strong community identity", knownFor: "local services, trades and community businesses", businessType: "trades and community businesses" },
      "Benton":       { character: "suburban north-east Newcastle area", knownFor: "local retail, family services and community businesses", businessType: "family and community businesses" },
      "Longbenton":   { character: "established suburban area north-east of the city", knownFor: "community services, local trades and retail", businessType: "community and service businesses" },
      "Ponteland":    { character: "affluent commuter village near the airport", knownFor: "premium services, quality retail and professional businesses", businessType: "premium and professional service businesses" },
      "Cramlington":  { character: "large planned new town north of Newcastle", knownFor: "retail parks, professional services and growing businesses", businessType: "retail and service businesses" },
    }
  },

  {
    primaryCity: "Bristol",
    coreAreas: ["Clifton","Redland","Westbury-on-Trym","Bishopston","Southville","Bedminster","Stokes Croft","Fishponds","Kingswood","Henleaze","Horfield","Brislington","Filton","Long Ashton","Keynsham"],
    priorityAreas: ["Clifton","Redland","Westbury-on-Trym","Henleaze","Southville"],
    areaProfiles: {
      "Clifton":            { character: "prestigious Georgian hilltop village district", knownFor: "boutique retail, restaurants, professional services and tourist trade", businessType: "premium, independent and professional businesses" },
      "Redland":            { character: "attractive north Bristol residential suburb", knownFor: "independent businesses, professional services and community retail", businessType: "independent and professional businesses" },
      "Westbury-on-Trym":  { character: "well-regarded north Bristol village suburb", knownFor: "quality retail, professional services and local businesses", businessType: "quality and professional service businesses" },
      "Bishopston":         { character: "popular north Bristol residential area", knownFor: "independent cafés, boutiques and professional services", businessType: "independent and professional businesses" },
      "Southville":         { character: "creative and progressive south Bristol community", knownFor: "independent businesses, street art culture and creative services", businessType: "creative and independent businesses" },
      "Bedminster":         { character: "south Bristol community with growing indie scene", knownFor: "independent retail, markets and community businesses", businessType: "independent and community businesses" },
      "Stokes Croft":       { character: "iconic creative and cultural corridor", knownFor: "creative businesses, street art and independent traders", businessType: "creative, arts and independent businesses" },
      "Fishponds":          { character: "large east Bristol residential suburb", knownFor: "community services, everyday retail and local trades", businessType: "community and trades businesses" },
      "Kingswood":          { character: "large east Bristol urban district", knownFor: "retail, trades and everyday service businesses", businessType: "retail and service businesses" },
      "Henleaze":           { character: "sought-after north Bristol residential area", knownFor: "independent retail, professional services and quality local businesses", businessType: "professional and independent businesses" },
      "Horfield":           { character: "north Bristol suburban district", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Brislington":        { character: "south-east Bristol residential suburb", knownFor: "local retail, trades and community services", businessType: "community and trades businesses" },
      "Filton":             { character: "north Bristol area with aerospace industry links", knownFor: "engineering, tech and professional service businesses", businessType: "tech, engineering and professional businesses" },
      "Long Ashton":        { character: "affluent village on the western fringe of Bristol", knownFor: "premium services, independent businesses and rural lifestyle traders", businessType: "premium and lifestyle businesses" },
      "Keynsham":           { character: "market town between Bristol and Bath", knownFor: "local retail, community services and family businesses", businessType: "community and family service businesses" },
    }
  },

  {
    primaryCity: "Nottingham",
    coreAreas: ["West Bridgford","Beeston","Arnold","Carlton","Long Eaton","Ruddington","Radcliffe on Trent","Gedling","Clifton","Bulwell","Hucknall","Mapperley","Wollaton","Sherwood","Netherfield"],
    priorityAreas: ["West Bridgford","Beeston","Arnold","Wollaton","Mapperley"],
    areaProfiles: {
      "West Bridgford":       { character: "affluent south Nottingham suburb", knownFor: "premium retail, professional services and quality dining", businessType: "professional and premium service businesses" },
      "Beeston":              { character: "busy suburban town west of Nottingham", knownFor: "local retail, student services and community businesses", businessType: "retail and community businesses" },
      "Arnold":               { character: "large north-east Nottingham suburb", knownFor: "retail, trades and local service businesses", businessType: "retail, trades and service businesses" },
      "Carlton":              { character: "established east Nottingham suburb", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Long Eaton":           { character: "busy Derbyshire border town", knownFor: "furniture, local retail and community businesses", businessType: "retail and community businesses" },
      "Ruddington":           { character: "attractive village south of Nottingham", knownFor: "independent retail, trades and community services", businessType: "independent and community businesses" },
      "Radcliffe on Trent":   { character: "popular commuter village east of Nottingham", knownFor: "local services, independent businesses and quality trades", businessType: "independent and quality service businesses" },
      "Gedling":              { character: "residential area north-east of Nottingham", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Clifton":              { character: "large south Nottingham estate and suburb", knownFor: "community services, everyday retail and local trades", businessType: "community and trades businesses" },
      "Bulwell":              { character: "north Nottingham community area", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Hucknall":             { character: "former mining town north of Nottingham", knownFor: "retail, trades and community service businesses", businessType: "trades and community businesses" },
      "Mapperley":            { character: "well-regarded east Nottingham suburb", knownFor: "independent businesses, local services and professional trades", businessType: "independent and professional businesses" },
      "Wollaton":             { character: "prestigious west Nottingham residential suburb", knownFor: "professional services, quality retail and premium businesses", businessType: "professional and premium businesses" },
      "Sherwood":             { character: "established north Nottingham suburb", knownFor: "independent retail, community businesses and local services", businessType: "independent and community businesses" },
      "Netherfield":          { character: "east Nottingham community area", knownFor: "community services, local trades and everyday retail", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Leicester",
    coreAreas: ["Oadby","Wigston","Hinckley","Loughborough","Market Harborough","Birstall","Syston","Blaby","Glenfield","Braunstone","Beaumont Leys","Hamilton","Thurmaston","Anstey","Kibworth"],
    priorityAreas: ["Oadby","Loughborough","Hinckley","Market Harborough","Birstall"],
    areaProfiles: {
      "Oadby":            { character: "affluent south Leicester suburb", knownFor: "premium retail, professional services and quality dining", businessType: "professional and premium service businesses" },
      "Wigston":          { character: "established south Leicester town", knownFor: "local retail, trades and community services", businessType: "community and trades businesses" },
      "Hinckley":         { character: "busy market town west of Leicester", knownFor: "retail, manufacturing and local service businesses", businessType: "retail, trades and service businesses" },
      "Loughborough":     { character: "vibrant university town north of Leicester", knownFor: "student services, independent retail and sports businesses", businessType: "student-facing and independent businesses" },
      "Market Harborough":{ character: "prosperous market town south of Leicester", knownFor: "independent retail, professional services and quality traders", businessType: "independent and professional businesses" },
      "Birstall":         { character: "popular north Leicester suburb", knownFor: "local retail, retail parks and community services", businessType: "retail and community businesses" },
      "Syston":           { character: "growing north Leicester residential town", knownFor: "local services, trades and family businesses", businessType: "family and community businesses" },
      "Blaby":            { character: "south Leicester district centre", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Glenfield":        { character: "west Leicester residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Braunstone":       { character: "west Leicester community area", knownFor: "community services, local trades and everyday retail", businessType: "community and trades businesses" },
      "Beaumont Leys":    { character: "large north-west Leicester suburb", knownFor: "retail parks, community services and local businesses", businessType: "retail and community businesses" },
      "Hamilton":         { character: "north-east Leicester residential suburb", knownFor: "family services, local retail and community businesses", businessType: "family and community businesses" },
      "Thurmaston":       { character: "north Leicester retail and residential area", knownFor: "retail parks, local services and trade businesses", businessType: "retail and trades businesses" },
      "Anstey":           { character: "north-west Leicester village suburb", knownFor: "independent businesses, local services and community trades", businessType: "independent and community businesses" },
      "Kibworth":         { character: "charming village south-east of Leicester", knownFor: "independent retail, quality services and community businesses", businessType: "independent and quality service businesses" },
    }
  },

  {
    primaryCity: "Coventry",
    coreAreas: ["Kenilworth","Leamington Spa","Stratford-upon-Avon","Nuneaton","Bedworth","Rugby","Earlsdon","Coundon","Cheylesmore","Binley","Finham","Tile Hill","Allesley","Walsgrave","Wyken"],
    priorityAreas: ["Kenilworth","Leamington Spa","Earlsdon","Stratford-upon-Avon","Rugby"],
    areaProfiles: {
      "Kenilworth":        { character: "affluent historic town south of Coventry", knownFor: "independent retail, professional services and premium businesses", businessType: "premium and professional service businesses" },
      "Leamington Spa":    { character: "elegant Regency spa town", knownFor: "boutique retail, gaming industry and professional services", businessType: "tech, professional and premium service businesses" },
      "Stratford-upon-Avon":{ character: "world-famous Shakespeare heritage town", knownFor: "tourism, hospitality and quality independent businesses", businessType: "tourism, hospitality and independent businesses" },
      "Nuneaton":          { character: "large market town north of Coventry", knownFor: "retail, trades and community service businesses", businessType: "retail, trades and service businesses" },
      "Bedworth":          { character: "mining heritage town between Coventry and Nuneaton", knownFor: "community services, local trades and independent businesses", businessType: "community and trades businesses" },
      "Rugby":             { character: "historic market town east of Coventry", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Earlsdon":          { character: "sought-after south Coventry village suburb", knownFor: "independent retail, cafés and professional services", businessType: "independent and professional businesses" },
      "Coundon":           { character: "established north-west Coventry suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Cheylesmore":       { character: "residential south Coventry suburb", knownFor: "local services, family businesses and trades", businessType: "family and community businesses" },
      "Binley":            { character: "east Coventry residential area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Finham":            { character: "south Coventry residential suburb", knownFor: "family services, community businesses and local trades", businessType: "family and community businesses" },
      "Tile Hill":         { character: "west Coventry suburban area", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Allesley":          { character: "west Coventry village suburb", knownFor: "local services, quality trades and community businesses", businessType: "quality and community businesses" },
      "Walsgrave":         { character: "east Coventry area near the hospital", knownFor: "healthcare support services, local trades and community businesses", businessType: "healthcare and community businesses" },
      "Wyken":             { character: "north-east Coventry residential area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Bradford",
    coreAreas: ["Shipley","Bingley","Ilkley","Keighley","Skipton","Baildon","Guiseley","Idle","Queensbury","Cleckheaton","Brighouse","Thornton","Eccleshill","Wibsey","Great Horton"],
    priorityAreas: ["Ilkley","Shipley","Skipton","Baildon","Bingley"],
    areaProfiles: {
      "Shipley":     { character: "busy north Bradford town on the River Aire", knownFor: "local retail, community services and independent businesses", businessType: "independent and community businesses" },
      "Bingley":     { character: "historic Airedale market town", knownFor: "local retail, trades and community businesses", businessType: "community and trades businesses" },
      "Ilkley":      { character: "affluent Wharfedale spa town", knownFor: "premium retail, professional services and lifestyle businesses", businessType: "premium and lifestyle service businesses" },
      "Keighley":    { character: "large West Yorkshire mill town", knownFor: "retail, trades and community service businesses", businessType: "trades and community businesses" },
      "Skipton":     { character: "thriving Dales market town", knownFor: "tourism, independent retail and professional services", businessType: "independent and professional businesses" },
      "Baildon":     { character: "attractive moorland village suburb", knownFor: "quality retail, community services and professional businesses", businessType: "quality and professional businesses" },
      "Guiseley":    { character: "suburban town between Leeds and Bradford", knownFor: "local retail, trades and commuter services", businessType: "community and service businesses" },
      "Idle":        { character: "north Bradford village suburb", knownFor: "independent businesses, local services and community trades", businessType: "independent and community businesses" },
      "Queensbury":  { character: "hillside village between Bradford and Halifax", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Cleckheaton": { character: "Spen Valley market town", knownFor: "retail, trades and community service businesses", businessType: "trades and community businesses" },
      "Brighouse":   { character: "Calder Valley market town", knownFor: "independent retail, trades and community businesses", businessType: "independent and community businesses" },
      "Thornton":    { character: "west Bradford village area", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Eccleshill":  { character: "north Bradford residential suburb", knownFor: "community services, local trades and family businesses", businessType: "community and trades businesses" },
      "Wibsey":      { character: "south Bradford residential community", knownFor: "local services, trades and community businesses", businessType: "community and trades businesses" },
      "Great Horton":{ character: "west Bradford urban residential area", knownFor: "community services, local trades and diverse businesses", businessType: "diverse and community businesses" },
    }
  },

  {
    primaryCity: "Hull",
    coreAreas: ["Beverley","Hessle","Cottingham","Anlaby","Willerby","Brough","Hornsea","Bridlington","Driffield","Hedon","Kirkella","Anlaby Common","Haltemprice","Newland","Bilton"],
    priorityAreas: ["Beverley","Cottingham","Hessle","Willerby","Bridlington"],
    areaProfiles: {
      "Beverley":        { character: "beautiful East Riding market town", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Hessle":          { character: "popular west Hull suburb near the Humber Bridge", knownFor: "local retail, community services and professional businesses", businessType: "professional and community businesses" },
      "Cottingham":      { character: "large north Hull suburb with village character", knownFor: "independent retail, professional services and quality local businesses", businessType: "independent and professional businesses" },
      "Anlaby":          { character: "established west Hull residential suburb", knownFor: "local services, family businesses and community trades", businessType: "family and community businesses" },
      "Willerby":        { character: "prosperous west Hull village suburb", knownFor: "quality retail, professional services and local businesses", businessType: "professional and quality service businesses" },
      "Brough":          { character: "East Riding commuter town with business park", knownFor: "professional services, aerospace links and local businesses", businessType: "professional and service businesses" },
      "Hornsea":         { character: "coastal resort town east of Hull", knownFor: "tourism, seaside retail and community businesses", businessType: "tourism and community businesses" },
      "Bridlington":     { character: "popular coastal resort town", knownFor: "tourism, seaside hospitality and local businesses", businessType: "tourism, hospitality and community businesses" },
      "Driffield":       { character: "market town in the East Yorkshire Wolds", knownFor: "agricultural, local retail and community businesses", businessType: "agricultural and community businesses" },
      "Hedon":           { character: "historic small town east of Hull", knownFor: "community services, local trades and small businesses", businessType: "community and trades businesses" },
      "Kirkella":        { character: "affluent west Hull village suburb", knownFor: "premium services, professional businesses and quality trades", businessType: "premium and professional businesses" },
      "Anlaby Common":   { character: "west Hull suburban area", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Haltemprice":     { character: "suburban west Hull area", knownFor: "family services, local businesses and community trades", businessType: "family and community businesses" },
      "Newland":         { character: "north Hull residential area", knownFor: "local services, community businesses and trades", businessType: "community and service businesses" },
      "Bilton":          { character: "east Hull residential suburb", knownFor: "community services, local trades and everyday retail", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Stoke-on-Trent",
    coreAreas: ["Newcastle-under-Lyme","Stone","Stafford","Cannock","Lichfield","Kidsgrove","Leek","Cheadle","Uttoxeter","Rugeley","Biddulph","Congleton","Alsager","Longton","Hanley"],
    priorityAreas: ["Newcastle-under-Lyme","Stafford","Stone","Lichfield","Leek"],
    areaProfiles: {
      "Newcastle-under-Lyme":{ character: "large market town adjacent to Stoke", knownFor: "retail, professional services and community businesses", businessType: "retail and professional service businesses" },
      "Stone":               { character: "attractive market town in Staffordshire", knownFor: "independent retail, local services and community businesses", businessType: "independent and community businesses" },
      "Stafford":            { character: "county town with strong professional base", knownFor: "professional services, retail and public sector businesses", businessType: "professional and service businesses" },
      "Cannock":             { character: "busy south Staffordshire market town", knownFor: "retail, trades and community service businesses", businessType: "retail and trades businesses" },
      "Lichfield":           { character: "historic cathedral city in Staffordshire", knownFor: "independent retail, professional services and heritage businesses", businessType: "independent and professional businesses" },
      "Kidsgrove":           { character: "north Staffordshire community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Leek":                { character: "Staffordshire Moorlands market town", knownFor: "independent retail, arts and crafts and community businesses", businessType: "independent and creative businesses" },
      "Cheadle":             { character: "Staffordshire Moorlands town", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Uttoxeter":           { character: "market town in east Staffordshire", knownFor: "agricultural, retail and community service businesses", businessType: "agricultural and community businesses" },
      "Rugeley":             { character: "south Staffordshire market town", knownFor: "local retail, community services and trades", businessType: "community and trades businesses" },
      "Biddulph":            { character: "north Staffordshire moorland town", knownFor: "community services, local trades and small businesses", businessType: "community and trades businesses" },
      "Congleton":           { character: "Cheshire market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and community businesses" },
      "Alsager":             { character: "Cheshire commuter town", knownFor: "local services, professional businesses and community trades", businessType: "professional and community businesses" },
      "Longton":             { character: "The Potteries town with heritage character", knownFor: "pottery, retail and community businesses", businessType: "heritage, retail and community businesses" },
      "Hanley":              { character: "Stoke city centre retail district", knownFor: "retail, professional services and commercial businesses", businessType: "retail and professional businesses" },
    }
  },

  {
    primaryCity: "Derby",
    coreAreas: ["Allestree","Mickleover","Littleover","Chellaston","Chaddesden","Alvaston","Spondon","Mackworth","Oakwood","Borrowash","Duffield","Belper","Ripley","Ilkeston","Long Eaton"],
    priorityAreas: ["Allestree","Mickleover","Littleover","Chellaston","Duffield"],
    areaProfiles: {
      "Allestree":    { character: "prosperous north Derby suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family service businesses" },
      "Mickleover":   { character: "popular west Derby residential suburb", knownFor: "local retail, professional services and community businesses", businessType: "professional and community businesses" },
      "Littleover":   { character: "sought-after south Derby suburb", knownFor: "quality retail, professional services and family businesses", businessType: "professional and family businesses" },
      "Chellaston":   { character: "large south Derby residential suburb", knownFor: "local services, family businesses and community trades", businessType: "family and community businesses" },
      "Chaddesden":   { character: "east Derby residential area", knownFor: "community services, local trades and everyday retail", businessType: "community and trades businesses" },
      "Alvaston":     { character: "south-east Derby residential area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Spondon":      { character: "east Derby village suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Mackworth":    { character: "west Derby established suburb", knownFor: "community services, local services and trades", businessType: "community and service businesses" },
      "Oakwood":      { character: "north-east Derby suburban area", knownFor: "family services, local retail and community businesses", businessType: "family and community businesses" },
      "Borrowash":    { character: "east Derby village suburb", knownFor: "local services, community trades and independent businesses", businessType: "community and independent businesses" },
      "Duffield":     { character: "attractive village north of Derby", knownFor: "independent businesses, quality services and community trades", businessType: "independent and quality businesses" },
      "Belper":       { character: "Derwent Valley heritage town", knownFor: "independent retail, arts and community businesses", businessType: "independent and creative businesses" },
      "Ripley":       { character: "Amber Valley market town", knownFor: "retail, trades and community service businesses", businessType: "trades and community businesses" },
      "Ilkeston":     { character: "Derbyshire market town", knownFor: "retail, trades and community businesses", businessType: "retail and community businesses" },
      "Long Eaton":   { character: "Erewash furniture and retail town", knownFor: "furniture, retail and community businesses", businessType: "retail and community businesses" },
    }
  },

  {
    primaryCity: "Southampton",
    coreAreas: ["Eastleigh","Totton","Chandler's Ford","Hedge End","Fair Oak","Romsey","Ringwood","Lyndhurst","Hythe","Hamble","Botley","Bursledon","Netley","West End","North Baddesley"],
    priorityAreas: ["Eastleigh","Chandler's Ford","Hedge End","Romsey","Totton"],
    areaProfiles: {
      "Eastleigh":        { character: "busy Hampshire market town", knownFor: "retail, local services and professional businesses", businessType: "retail and professional businesses" },
      "Totton":           { character: "large west Southampton suburb", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Chandler's Ford":  { character: "popular commuter suburb north of Southampton", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Hedge End":        { character: "east Southampton commuter town", knownFor: "retail parks, professional services and growing businesses", businessType: "retail and professional businesses" },
      "Fair Oak":         { character: "east Hampshire village suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Romsey":           { character: "attractive Hampshire market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Ringwood":         { character: "New Forest market town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Lyndhurst":        { character: "New Forest capital village", knownFor: "tourism, independent retail and lifestyle businesses", businessType: "tourism and lifestyle businesses" },
      "Hythe":            { character: "New Forest waterside town", knownFor: "maritime, community and lifestyle businesses", businessType: "maritime and lifestyle businesses" },
      "Hamble":           { character: "yachting village on Southampton Water", knownFor: "marine businesses, independent retail and lifestyle services", businessType: "marine and lifestyle businesses" },
      "Botley":           { character: "east Hampshire market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Bursledon":        { character: "riverside village suburb south-east of Southampton", knownFor: "local services, community trades and lifestyle businesses", businessType: "community and lifestyle businesses" },
      "Netley":           { character: "waterside village suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "West End":         { character: "east Southampton commuter suburb", knownFor: "family services, local retail and community businesses", businessType: "family and community businesses" },
      "North Baddesley":  { character: "north Southampton village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Portsmouth",
    coreAreas: ["Fareham","Gosport","Havant","Waterlooville","Lee-on-the-Solent","Emsworth","Petersfield","Horndean","Hedge End","Portchester","Stubbington","Denmead","Wickham","Southsea","Hilsea"],
    priorityAreas: ["Fareham","Havant","Waterlooville","Gosport","Southsea"],
    areaProfiles: {
      "Fareham":           { character: "busy Hampshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Gosport":           { character: "naval heritage town facing Portsmouth", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Havant":            { character: "large south Hampshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and community businesses" },
      "Waterlooville":     { character: "large north Portsmouth suburban town", knownFor: "retail parks, local services and community businesses", businessType: "retail and community businesses" },
      "Lee-on-the-Solent": { character: "coastal residential suburb west of Gosport", knownFor: "lifestyle businesses, local services and community trades", businessType: "lifestyle and community businesses" },
      "Emsworth":          { character: "picturesque harbour town on the estuary", knownFor: "boutique businesses, independent retail and lifestyle services", businessType: "lifestyle and independent businesses" },
      "Petersfield":       { character: "East Hampshire market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Horndean":          { character: "south Hampshire village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Portchester":       { character: "north Portsmouth coastal suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Stubbington":       { character: "Fareham suburban village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Denmead":           { character: "north Hampshire village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Wickham":           { character: "historic village in south Hampshire", knownFor: "independent businesses, quality services and community trades", businessType: "independent and community businesses" },
      "Southsea":          { character: "vibrant coastal suburb of Portsmouth", knownFor: "independent retail, restaurants and lifestyle businesses", businessType: "independent and lifestyle businesses" },
      "Hilsea":            { character: "north Portsmouth gateway suburb", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Hedge End":         { character: "east Southampton/Portsmouth commuter area", knownFor: "retail parks, professional services and growing businesses", businessType: "retail and professional businesses" },
    }
  },

  {
    primaryCity: "Brighton",
    coreAreas: ["Hove","Worthing","Lewes","Burgess Hill","Haywards Heath","Eastbourne","Bexhill","Crawley","Horsham","Shoreham-by-Sea","Lancing","Peacehaven","Rottingdean","Saltdean","Falmer"],
    priorityAreas: ["Hove","Worthing","Lewes","Haywards Heath","Horsham"],
    areaProfiles: {
      "Hove":           { character: "prosperous seaside suburb adjacent to Brighton", knownFor: "independent retail, restaurants and professional services", businessType: "independent and professional businesses" },
      "Worthing":       { character: "popular West Sussex coastal town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Lewes":          { character: "historic East Sussex county town", knownFor: "independent retail, arts and heritage businesses", businessType: "independent and heritage businesses" },
      "Burgess Hill":   { character: "mid-Sussex market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Haywards Heath": { character: "mid-Sussex commuter town", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Eastbourne":     { character: "East Sussex coastal resort town", knownFor: "tourism, retail and professional service businesses", businessType: "tourism and professional businesses" },
      "Bexhill":        { character: "East Sussex coastal town", knownFor: "community businesses, retail and lifestyle services", businessType: "community and lifestyle businesses" },
      "Crawley":        { character: "large West Sussex new town near Gatwick", knownFor: "aviation, professional services and retail", businessType: "aviation-linked, professional and retail businesses" },
      "Horsham":        { character: "prosperous West Sussex market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Shoreham-by-Sea":{ character: "coastal town on the River Adur", knownFor: "community businesses, independent retail and lifestyle services", businessType: "community and lifestyle businesses" },
      "Lancing":        { character: "West Sussex coastal village suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Peacehaven":     { character: "East Sussex coastal suburban town", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Rottingdean":    { character: "picturesque east Brighton coastal village", knownFor: "independent businesses, arts and community services", businessType: "independent and community businesses" },
      "Saltdean":       { character: "east Brighton coastal suburb", knownFor: "community services, local trades and lifestyle businesses", businessType: "community and lifestyle businesses" },
      "Falmer":         { character: "university village north of Brighton", knownFor: "student and academic services and businesses", businessType: "academic and student-facing businesses" },
    }
  },

  {
    primaryCity: "Plymouth",
    coreAreas: ["Saltash","Torpoint","Ivybridge","Plymstock","Plympton","Tavistock","Kingsbridge","Totnes","Dawlish","Teignmouth","Okehampton","Buckfastleigh","Yelverton","Modbury","Wembury"],
    priorityAreas: ["Saltash","Tavistock","Plymstock","Ivybridge","Plympton"],
    areaProfiles: {
      "Saltash":       { character: "Cornish gateway town on the Tamar", knownFor: "community services, local retail and independent businesses", businessType: "community and independent businesses" },
      "Torpoint":      { character: "Cornish ferry town opposite Plymouth", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Ivybridge":     { character: "south Devon commuter town", knownFor: "local services, family businesses and community trades", businessType: "family and community businesses" },
      "Plymstock":     { character: "large south Plymouth suburban area", knownFor: "retail, community services and family businesses", businessType: "retail and community businesses" },
      "Plympton":      { character: "east Plymouth historic town and suburb", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Tavistock":     { character: "Dartmoor market town west of Plymouth", knownFor: "independent retail, community services and professional businesses", businessType: "independent and professional businesses" },
      "Kingsbridge":   { character: "South Hams market town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Totnes":        { character: "progressive South Devon market town", knownFor: "independent businesses, alternative lifestyle and creative services", businessType: "independent and creative businesses" },
      "Dawlish":       { character: "South Devon coastal resort", knownFor: "tourism, seaside businesses and community services", businessType: "tourism and community businesses" },
      "Teignmouth":    { character: "South Devon estuary port and resort", knownFor: "tourism, maritime and community businesses", businessType: "maritime and tourism businesses" },
      "Okehampton":    { character: "north Dartmoor market town", knownFor: "agricultural, community and local service businesses", businessType: "agricultural and community businesses" },
      "Buckfastleigh": { character: "south Dartmoor town near Buckfast Abbey", knownFor: "tourism, community and independent businesses", businessType: "tourism and independent businesses" },
      "Yelverton":     { character: "west Dartmoor village suburb", knownFor: "community services, local trades and lifestyle businesses", businessType: "lifestyle and community businesses" },
      "Modbury":       { character: "South Hams market town", knownFor: "independent businesses, community services and quality trades", businessType: "independent and community businesses" },
      "Wembury":       { character: "south Devon coastal village", knownFor: "lifestyle businesses, community services and local trades", businessType: "lifestyle and community businesses" },
    }
  },

  {
    primaryCity: "Reading",
    coreAreas: ["Wokingham","Bracknell","Newbury","Thatcham","Henley-on-Thames","Maidenhead","Marlow","Caversham","Woodley","Earley","Tilehurst","Theale","Pangbourne","Twyford","Sandhurst"],
    priorityAreas: ["Wokingham","Henley-on-Thames","Caversham","Newbury","Maidenhead"],
    areaProfiles: {
      "Wokingham":        { character: "prosperous Berkshire market town", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Bracknell":        { character: "modern Berkshire new town with business parks", knownFor: "tech and professional service businesses", businessType: "tech and professional businesses" },
      "Newbury":          { character: "Berkshire market town with racecourse", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Thatcham":         { character: "large Berkshire commuter town", knownFor: "community services, local retail and professional businesses", businessType: "community and professional businesses" },
      "Henley-on-Thames": { character: "prestigious riverside Oxfordshire town", knownFor: "premium retail, professional services and lifestyle businesses", businessType: "premium and lifestyle businesses" },
      "Maidenhead":       { character: "Thames Valley commuter town in Berkshire", knownFor: "professional services, retail and business community", businessType: "professional and retail businesses" },
      "Marlow":           { character: "affluent Thames-side Buckinghamshire town", knownFor: "premium retail, restaurants and professional services", businessType: "premium and professional businesses" },
      "Caversham":        { character: "sought-after north Reading suburb", knownFor: "independent retail, professional services and quality businesses", businessType: "professional and independent businesses" },
      "Woodley":          { character: "east Reading suburban town", knownFor: "local retail, community services and family businesses", businessType: "family and community businesses" },
      "Earley":           { character: "south-east Reading residential suburb", knownFor: "professional services, local retail and family businesses", businessType: "professional and family businesses" },
      "Tilehurst":        { character: "west Reading residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Theale":           { character: "west Berkshire village suburb with business park", knownFor: "professional services, trades and local businesses", businessType: "professional and service businesses" },
      "Pangbourne":       { character: "attractive Thames-side Berkshire village", knownFor: "independent businesses, premium services and community trades", businessType: "premium and independent businesses" },
      "Twyford":          { character: "Berkshire commuter village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Sandhurst":        { character: "south Berkshire town with military heritage", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Wolverhampton",
    coreAreas: ["Bridgnorth","Tettenhall","Wombourne","Codsall","Penkridge","Albrighton","Pattingham","Penn","Bilston","Sedgley","Dudley","Kingswinford","Stourbridge","Halesowen","Brierley Hill"],
    priorityAreas: ["Tettenhall","Penn","Wombourne","Dudley","Stourbridge"],
    areaProfiles: {
      "Bridgnorth":    { character: "historic Shropshire riverside market town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Tettenhall":    { character: "affluent west Wolverhampton village suburb", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "Wombourne":     { character: "large south Staffordshire village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Codsall":       { character: "prosperous south Staffordshire commuter village", knownFor: "quality retail, professional services and community businesses", businessType: "professional and community businesses" },
      "Penkridge":     { character: "south Staffordshire market village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Albrighton":    { character: "Shropshire commuter village", knownFor: "community services, local trades and quality businesses", businessType: "quality and community businesses" },
      "Pattingham":    { character: "south Staffordshire rural village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Penn":          { character: "prosperous south Wolverhampton suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Bilston":       { character: "East Wolverhampton urban area", knownFor: "community services, trades and diverse businesses", businessType: "community and trades businesses" },
      "Sedgley":       { character: "Black Country community area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Dudley":        { character: "Black Country town with castle heritage", knownFor: "retail, trades and community service businesses", businessType: "retail, trades and community businesses" },
      "Kingswinford":  { character: "west Black Country suburban area", knownFor: "retail, community services and local trades", businessType: "community and trades businesses" },
      "Stourbridge":   { character: "Black Country market town and glassmaking centre", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Halesowen":     { character: "south Black Country market town", knownFor: "retail, trades and community businesses", businessType: "retail and community businesses" },
      "Brierley Hill": { character: "Black Country commercial and retail centre", knownFor: "retail parks, trades and community businesses", businessType: "retail and trades businesses" },
    }
  },

  {
    primaryCity: "Sunderland",
    coreAreas: ["Washington","Houghton-le-Spring","Hetton-le-Hole","Seaham","Peterlee","Durham","Chester-le-Street","Consett","Stanley","Brandon","Lanchester","Spennymoor","Bishop Auckland","Newton Aycliffe","Sedgefield"],
    priorityAreas: ["Washington","Durham","Chester-le-Street","Seaham","Houghton-le-Spring"],
    areaProfiles: {
      "Washington":        { character: "large new town west of Sunderland", knownFor: "business parks, retail and community service businesses", businessType: "business park and service businesses" },
      "Houghton-le-Spring":{ character: "historic Durham coalfield market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Hetton-le-Hole":    { character: "former mining community in County Durham", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Seaham":            { character: "County Durham coastal town", knownFor: "community services, seaside businesses and trades", businessType: "community and coastal businesses" },
      "Peterlee":          { character: "east Durham new town", knownFor: "business parks, community services and local trades", businessType: "business and community businesses" },
      "Durham":            { character: "historic World Heritage cathedral city", knownFor: "tourism, professional services and independent businesses", businessType: "tourism, professional and independent businesses" },
      "Chester-le-Street": { character: "county Durham market town", knownFor: "retail, community services and local businesses", businessType: "retail and community businesses" },
      "Consett":           { character: "west Durham former steel town", knownFor: "community services, local trades and independent businesses", businessType: "community and trades businesses" },
      "Stanley":           { character: "north-west Durham community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Brandon":           { character: "west Durham residential town", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Lanchester":        { character: "north-west Durham village", knownFor: "community services, local businesses and quality trades", businessType: "quality and community businesses" },
      "Spennymoor":        { character: "central Durham market town", knownFor: "community services, retail and local trades", businessType: "community and trades businesses" },
      "Bishop Auckland":   { character: "central Durham market town", knownFor: "retail, community services and local businesses", businessType: "retail and community businesses" },
      "Newton Aycliffe":   { character: "County Durham new town with industrial heritage", knownFor: "manufacturing, business parks and community services", businessType: "manufacturing and service businesses" },
      "Sedgefield":        { character: "County Durham market town", knownFor: "community services, independent businesses and quality trades", businessType: "independent and community businesses" },
    }
  },

  {
    primaryCity: "York",
    coreAreas: ["Harrogate","Knaresborough","Selby","Malton","Pocklington","Tadcaster","Easingwold","Thirsk","Boroughbridge","Ripon","Skipton","Northallerton","Helmsley","Pickering","Scarborough"],
    priorityAreas: ["Harrogate","Knaresborough","Ripon","Selby","Thirsk"],
    areaProfiles: {
      "Harrogate":    { character: "elegant spa town with strong retail and business community", knownFor: "premium retail, professional services and conference business", businessType: "premium, professional and conference businesses" },
      "Knaresborough":{ character: "historic market town with riverside charm", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Selby":        { character: "market town in the Vale of York", knownFor: "community services, retail and local businesses", businessType: "community and retail businesses" },
      "Malton":       { character: "North Yorkshire food capital and market town", knownFor: "artisan food, independent retail and community businesses", businessType: "food, independent and community businesses" },
      "Pocklington":  { character: "East Yorkshire market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Tadcaster":    { character: "North Yorkshire brewing town", knownFor: "brewing, community services and local businesses", businessType: "brewing, community and local businesses" },
      "Easingwold":   { character: "North Yorkshire market town", knownFor: "independent retail, community services and quality trades", businessType: "independent and community businesses" },
      "Thirsk":       { character: "North Yorkshire market town with racecourse", knownFor: "independent retail, community services and hospitality", businessType: "independent and hospitality businesses" },
      "Boroughbridge": { character: "North Yorkshire village with Roman heritage", knownFor: "community services, local businesses and quality trades", businessType: "community and independent businesses" },
      "Ripon":        { character: "North Yorkshire cathedral city", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Skipton":      { character: "Dales gateway market town", knownFor: "tourism, independent retail and professional services", businessType: "independent and tourism businesses" },
      "Northallerton":{ character: "North Yorkshire county town", knownFor: "retail, professional services and community businesses", businessType: "professional and community businesses" },
      "Helmsley":     { character: "North York Moors market town", knownFor: "tourism, independent retail and lifestyle businesses", businessType: "tourism and independent businesses" },
      "Pickering":    { character: "North York Moors gateway town", knownFor: "tourism, community businesses and local trades", businessType: "tourism and community businesses" },
      "Scarborough":  { character: "North Yorkshire coastal resort and spa town", knownFor: "tourism, hospitality and community businesses", businessType: "tourism and hospitality businesses" },
    }
  },

  {
    primaryCity: "Exeter",
    coreAreas: ["Topsham","Exmouth","Sidmouth","Crediton","Okehampton","Cullompton","Tiverton","Newton Abbot","Dawlish","Heavitree","Pinhoe","Alphington","Wonford","Countess Wear","Ide"],
    priorityAreas: ["Exmouth","Topsham","Tiverton","Crediton","Newton Abbot"],
    areaProfiles: {
      "Topsham":     { character: "historic estuary town and suburb of Exeter", knownFor: "independent businesses, quality retail and lifestyle services", businessType: "independent and lifestyle businesses" },
      "Exmouth":     { character: "popular east Devon coastal resort", knownFor: "tourism, independent retail and lifestyle businesses", businessType: "tourism and lifestyle businesses" },
      "Sidmouth":    { character: "elegant east Devon coastal resort", knownFor: "quality retail, independent businesses and lifestyle services", businessType: "premium and lifestyle businesses" },
      "Crediton":    { character: "mid-Devon market town", knownFor: "agricultural, community and independent businesses", businessType: "agricultural and community businesses" },
      "Okehampton":  { character: "north Dartmoor gateway market town", knownFor: "community services, local trades and tourism", businessType: "community and tourism businesses" },
      "Cullompton":  { character: "mid-Devon market town on the M5", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Tiverton":    { character: "mid-Devon market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Newton Abbot":{ character: "south Devon market town", knownFor: "retail, community services and professional businesses", businessType: "retail and professional businesses" },
      "Dawlish":     { character: "south Devon coastal resort", knownFor: "tourism, seaside businesses and community services", businessType: "tourism and community businesses" },
      "Heavitree":   { character: "east Exeter residential suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Pinhoe":      { character: "north-east Exeter residential suburb", knownFor: "local services, family businesses and community trades", businessType: "family and community businesses" },
      "Alphington":  { character: "south-west Exeter residential village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Wonford":     { character: "south-east Exeter residential area", knownFor: "community services, local trades and everyday businesses", businessType: "community and trades businesses" },
      "Countess Wear":{ character: "south Exeter riverside suburb", knownFor: "local services, community trades and independent businesses", businessType: "community and independent businesses" },
      "Ide":         { character: "west Exeter village suburb", knownFor: "community services, local businesses and quality trades", businessType: "community and quality businesses" },
    }
  },

  {
    primaryCity: "Cambridge",
    coreAreas: ["Ely","St Ives","St Neots","Huntingdon","March","Saffron Walden","Royston","Haverhill","Newmarket","Soham","Sawston","Cottenham","Waterbeach","Histon","Trumpington"],
    priorityAreas: ["Ely","Newmarket","St Ives","Huntingdon","Saffron Walden"],
    areaProfiles: {
      "Ely":            { character: "cathedral city on the Isle of Ely", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "St Ives":        { character: "historic Cambridgeshire market town", knownFor: "independent retail, community services and professional businesses", businessType: "independent and professional businesses" },
      "St Neots":       { character: "large Cambridgeshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Huntingdon":     { character: "Cambridgeshire county town", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "March":          { character: "Fenland market town", knownFor: "community services, local trades and retail businesses", businessType: "community and trades businesses" },
      "Saffron Walden": { character: "beautiful north Essex market town", knownFor: "independent retail, professional services and heritage businesses", businessType: "independent and professional businesses" },
      "Royston":        { character: "south Cambridgeshire market town", knownFor: "local retail, community services and professional businesses", businessType: "community and professional businesses" },
      "Haverhill":      { character: "west Suffolk overspill town near Cambridge", knownFor: "community services, retail and local trades", businessType: "community and trades businesses" },
      "Newmarket":      { character: "horse racing capital of the world", knownFor: "racing industry, independent retail and professional services", businessType: "racing, independent and professional businesses" },
      "Soham":          { character: "east Cambridgeshire market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Sawston":        { character: "south Cambridgeshire village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Cottenham":      { character: "north Cambridge village suburb", knownFor: "local services, community trades and independent businesses", businessType: "community and independent businesses" },
      "Waterbeach":     { character: "north Cambridge village", knownFor: "community services, local businesses and family trades", businessType: "family and community businesses" },
      "Histon":         { character: "north Cambridge commuter village", knownFor: "community services, independent businesses and quality trades", businessType: "independent and community businesses" },
      "Trumpington":    { character: "south Cambridge suburban village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Oxford",
    coreAreas: ["Abingdon","Witney","Bicester","Banbury","Didcot","Thame","Henley-on-Thames","Faringdon","Wantage","Wallingford","Chipping Norton","Carterton","Woodstock","Headington","Cowley"],
    priorityAreas: ["Abingdon","Bicester","Witney","Didcot","Headington"],
    areaProfiles: {
      "Abingdon":        { character: "historic Vale of White Horse market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Witney":          { character: "west Oxfordshire market town", knownFor: "independent retail, community services and professional businesses", businessType: "independent and professional businesses" },
      "Bicester":        { character: "north Oxfordshire market town with designer village", knownFor: "premium retail, professional services and growing businesses", businessType: "premium and professional businesses" },
      "Banbury":         { character: "north Oxfordshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Didcot":          { character: "south Oxfordshire growing town with science park", knownFor: "tech, professional services and community businesses", businessType: "tech and professional businesses" },
      "Thame":           { character: "south Oxfordshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Henley-on-Thames":{ character: "Thames-side regatta town", knownFor: "premium retail, professional services and lifestyle businesses", businessType: "premium and lifestyle businesses" },
      "Faringdon":       { character: "Vale of White Horse market town", knownFor: "community services, local trades and independent businesses", businessType: "independent and community businesses" },
      "Wantage":         { character: "Vale of White Horse market town", knownFor: "independent retail, community services and trades", businessType: "independent and community businesses" },
      "Wallingford":     { character: "south Oxfordshire Thames market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Chipping Norton": { character: "north Oxfordshire Cotswold town", knownFor: "independent retail, premium services and lifestyle businesses", businessType: "premium and independent businesses" },
      "Carterton":       { character: "west Oxfordshire RAF town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Woodstock":       { character: "north Oxfordshire Cotswold town near Blenheim", knownFor: "tourism, independent retail and premium services", businessType: "tourism and premium businesses" },
      "Headington":      { character: "east Oxford suburb with hospitals and university", knownFor: "healthcare, academic and professional businesses", businessType: "healthcare and professional businesses" },
      "Cowley":          { character: "south-east Oxford industrial and residential suburb", knownFor: "automotive history, community services and local businesses", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Norwich",
    coreAreas: ["Wymondham","Attleborough","Dereham","Swaffham","Fakenham","Aylsham","Holt","Sheringham","Cromer","North Walsham","Wroxham","Thorpe St Andrew","Sprowston","Hellesdon","Old Catton"],
    priorityAreas: ["Wymondham","Dereham","Aylsham","Thorpe St Andrew","Sprowston"],
    areaProfiles: {
      "Wymondham":        { character: "south Norfolk market town", knownFor: "independent retail, community services and professional businesses", businessType: "independent and professional businesses" },
      "Attleborough":     { character: "south Norfolk market town", knownFor: "community services, local trades and retail businesses", businessType: "community and trades businesses" },
      "Dereham":          { character: "mid-Norfolk market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Swaffham":         { character: "west Norfolk market town", knownFor: "community services, independent retail and local trades", businessType: "independent and community businesses" },
      "Fakenham":         { character: "north Norfolk market town with racecourse", knownFor: "independent retail, community services and trades", businessType: "independent and community businesses" },
      "Aylsham":          { character: "north Norfolk market town", knownFor: "independent retail, quality services and community businesses", businessType: "independent and community businesses" },
      "Holt":             { character: "north Norfolk gem market town", knownFor: "premium independent retail and lifestyle businesses", businessType: "premium and independent businesses" },
      "Sheringham":       { character: "north Norfolk coastal resort", knownFor: "tourism, independent retail and community businesses", businessType: "tourism and independent businesses" },
      "Cromer":           { character: "north Norfolk seaside resort", knownFor: "tourism, crab-fishing heritage and seaside businesses", businessType: "tourism and community businesses" },
      "North Walsham":    { character: "north Norfolk market town", knownFor: "community services, local trades and retail businesses", businessType: "community and trades businesses" },
      "Wroxham":          { character: "Broads boating capital village", knownFor: "tourism, boating businesses and independent retail", businessType: "tourism and independent businesses" },
      "Thorpe St Andrew": { character: "popular east Norwich riverside suburb", knownFor: "independent businesses, local services and community trades", businessType: "independent and community businesses" },
      "Sprowston":        { character: "north-east Norwich growing suburb", knownFor: "retail parks, family services and community businesses", businessType: "retail and family businesses" },
      "Hellesdon":        { character: "north-west Norwich residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Old Catton":       { character: "north Norwich village suburb", knownFor: "community services, local businesses and quality trades", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Middlesbrough",
    coreAreas: ["Stockton-on-Tees","Hartlepool","Darlington","Redcar","Guisborough","Thornaby","Billingham","Yarm","Eaglescliffe","Ingleby Barwick","Marton","Acklam","Nunthorpe","Great Ayton","Stokesley"],
    priorityAreas: ["Darlington","Stockton-on-Tees","Yarm","Guisborough","Marton"],
    areaProfiles: {
      "Stockton-on-Tees":  { character: "large Teesside market town on the River Tees", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Hartlepool":        { character: "coastal Teesside town with maritime heritage", knownFor: "community services, maritime and local businesses", businessType: "maritime and community businesses" },
      "Darlington":        { character: "County Durham market town with railway heritage", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Redcar":            { character: "North Yorkshire coastal town", knownFor: "seaside businesses, community services and local trades", businessType: "coastal and community businesses" },
      "Guisborough":       { character: "North Yorkshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Thornaby":          { character: "south Teesside urban area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Billingham":        { character: "Teesside chemical industry town", knownFor: "industrial services, community businesses and trades", businessType: "industrial and community businesses" },
      "Yarm":              { character: "affluent historic town on a Tees meander", knownFor: "premium retail, independent restaurants and professional services", businessType: "premium and professional businesses" },
      "Eaglescliffe":      { character: "prosperous south Stockton suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Ingleby Barwick":   { character: "large planned south Teesside suburb", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
      "Marton":            { character: "south Middlesbrough residential suburb", knownFor: "professional services, local retail and family businesses", businessType: "professional and family businesses" },
      "Acklam":            { character: "south-west Middlesbrough residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Nunthorpe":         { character: "south Middlesbrough village suburb", knownFor: "quality services, local businesses and community trades", businessType: "quality and community businesses" },
      "Great Ayton":       { character: "North York Moors village south of Middlesbrough", knownFor: "independent businesses, quality services and community trades", businessType: "independent and community businesses" },
      "Stokesley":         { character: "north Yorkshire market town", knownFor: "independent retail, community services and quality trades", businessType: "independent and community businesses" },
    }
  },

  {
    primaryCity: "Huddersfield",
    coreAreas: ["Halifax","Brighouse","Dewsbury","Batley","Morley","Mirfield","Slaithwaite","Marsden","Holmfirth","Kirkburton","Skelmanthorpe","Lindley","Birkby","Almondbury","Golcar"],
    priorityAreas: ["Halifax","Holmfirth","Brighouse","Lindley","Mirfield"],
    areaProfiles: {
      "Halifax":       { character: "Calder Valley historic market town", knownFor: "independent retail, community businesses and trades", businessType: "independent and community businesses" },
      "Brighouse":     { character: "Calder Valley market town", knownFor: "independent retail, trades and community businesses", businessType: "independent and community businesses" },
      "Dewsbury":      { character: "West Yorkshire textile heritage town", knownFor: "retail, trades and community service businesses", businessType: "retail and community businesses" },
      "Batley":        { character: "West Yorkshire former textile town", knownFor: "community services, trades and local retail", businessType: "community and trades businesses" },
      "Morley":        { character: "busy West Yorkshire market town", knownFor: "retail, trades and community businesses", businessType: "retail and community businesses" },
      "Mirfield":      { character: "Calder Valley commuter town", knownFor: "community services, professional businesses and trades", businessType: "professional and community businesses" },
      "Slaithwaite":   { character: "Colne Valley village with creative community", knownFor: "independent businesses, arts and community services", businessType: "independent and creative businesses" },
      "Marsden":       { character: "Colne Valley Pennine village", knownFor: "community businesses, arts and independent trades", businessType: "independent and community businesses" },
      "Holmfirth":     { character: "picturesque Holme Valley filming location town", knownFor: "independent retail, tourism and lifestyle businesses", businessType: "independent and tourism businesses" },
      "Kirkburton":    { character: "south Huddersfield village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Skelmanthorpe": { character: "south Kirklees village area", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Lindley":       { character: "north Huddersfield residential village suburb", knownFor: "independent businesses, quality services and community trades", businessType: "independent and community businesses" },
      "Birkby":        { character: "north Huddersfield residential area", knownFor: "diverse community businesses, local services and trades", businessType: "diverse and community businesses" },
      "Almondbury":    { character: "historic east Huddersfield village", knownFor: "community services, independent businesses and quality trades", businessType: "independent and community businesses" },
      "Golcar":        { character: "Colne Valley residential village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Preston",
    coreAreas: ["Leyland","Chorley","Bamber Bridge","Longridge","Garstang","Penwortham","Fulwood","Ribbleton","Lostock Hall","Buckshaw Village","Clayton-le-Woods","Euxton","Walmer Bridge","Kirkham","Freckleton"],
    priorityAreas: ["Leyland","Chorley","Fulwood","Penwortham","Bamber Bridge"],
    areaProfiles: {
      "Leyland":          { character: "south Lancashire automotive heritage town", knownFor: "industrial, community and retail businesses", businessType: "industrial and community businesses" },
      "Chorley":          { character: "busy Lancashire market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Bamber Bridge":    { character: "south Preston commuter suburb", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Longridge":        { character: "Ribble Valley town north-east of Preston", knownFor: "independent businesses, community services and quality trades", businessType: "independent and community businesses" },
      "Garstang":         { character: "Lancashire market town north of Preston", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Penwortham":       { character: "south Preston residential suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Fulwood":          { character: "prosperous north Preston residential suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Ribbleton":        { character: "east Preston residential area", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Lostock Hall":     { character: "south Preston suburban area", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Buckshaw Village": { character: "modern planned community south of Chorley", knownFor: "professional services, family businesses and community retail", businessType: "professional and family businesses" },
      "Clayton-le-Woods": { character: "suburban village south of Preston", knownFor: "community services, local trades and quality businesses", businessType: "community and quality businesses" },
      "Euxton":           { character: "Chorley suburb with village character", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Walmer Bridge":    { character: "rural south Preston village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Kirkham":          { character: "Fylde market town", knownFor: "community services, retail and local trades", businessType: "community and trades businesses" },
      "Freckleton":       { character: "Fylde peninsula village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Warrington",
    coreAreas: ["Runcorn","Widnes","Northwich","Winsford","Lymm","Appleton","Great Sankey","Woolston","Stockton Heath","Culcheth","Grappenhall","Thelwall","Penketh","Frodsham","Helsby"],
    priorityAreas: ["Lymm","Stockton Heath","Frodsham","Northwich","Grappenhall"],
    areaProfiles: {
      "Runcorn":        { character: "Halton new town on the Mersey", knownFor: "business parks, community services and trades", businessType: "business and community businesses" },
      "Widnes":         { character: "Halton chemical heritage town on the Mersey", knownFor: "industrial, community services and retail businesses", businessType: "industrial and community businesses" },
      "Northwich":      { character: "Cheshire market town with salt heritage", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Winsford":       { character: "mid-Cheshire industrial and residential town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Lymm":           { character: "affluent Cheshire commuter village", knownFor: "independent businesses, premium services and community trades", businessType: "premium and independent businesses" },
      "Appleton":       { character: "south Warrington residential suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Great Sankey":   { character: "west Warrington suburban area", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Woolston":       { character: "east Warrington residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Stockton Heath": { character: "affluent south Warrington village suburb", knownFor: "independent retail, restaurants and professional services", businessType: "independent and professional businesses" },
      "Culcheth":       { character: "north Warrington village suburb", knownFor: "community services, quality businesses and local trades", businessType: "quality and community businesses" },
      "Grappenhall":    { character: "south Warrington village suburb", knownFor: "independent businesses, community services and premium trades", businessType: "premium and independent businesses" },
      "Thelwall":       { character: "south Warrington riverside village", knownFor: "community services, local trades and quality businesses", businessType: "quality and community businesses" },
      "Penketh":        { character: "west Warrington residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Frodsham":       { character: "north Cheshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Helsby":         { character: "north Cheshire village", knownFor: "community services, local businesses and quality trades", businessType: "community and quality businesses" },
    }
  },

  {
    primaryCity: "Chester",
    coreAreas: ["Ellesmere Port","Neston","Hoole","Saughall","Tarporley","Malpas","Farndon","Hawarden","Flint","Connah's Quay","Buckley","Mold","Deeside","Shotton","Broughton"],
    priorityAreas: ["Ellesmere Port","Tarporley","Neston","Hoole","Mold"],
    areaProfiles: {
      "Ellesmere Port":  { character: "Cheshire industrial port town on the Mersey", knownFor: "retail, community services and industrial businesses", businessType: "retail and community businesses" },
      "Neston":          { character: "Wirral peninsula market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Hoole":           { character: "popular east Chester suburb", knownFor: "independent businesses, cafés and local services", businessType: "independent and community businesses" },
      "Saughall":        { character: "north Chester village suburb", knownFor: "community services, local trades and quality businesses", businessType: "community and quality businesses" },
      "Tarporley":       { character: "mid-Cheshire market village", knownFor: "independent retail, premium services and community businesses", businessType: "premium and independent businesses" },
      "Malpas":          { character: "south Cheshire village market town", knownFor: "community services, independent businesses and quality trades", businessType: "independent and community businesses" },
      "Farndon":         { character: "west Cheshire riverside village", knownFor: "community services, local businesses and quality trades", businessType: "community and independent businesses" },
      "Hawarden":        { character: "north Wales border village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Flint":           { character: "north Wales coastal town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Connah's Quay":   { character: "north Wales industrial riverside town", knownFor: "industrial, community services and trades businesses", businessType: "industrial and community businesses" },
      "Buckley":         { character: "north-east Wales residential town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Mold":            { character: "Flintshire county town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Deeside":         { character: "north Wales industrial zone", knownFor: "manufacturing, industrial and business park services", businessType: "industrial and manufacturing businesses" },
      "Shotton":         { character: "north Wales steeltown community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Broughton":       { character: "north Wales aerospace village", knownFor: "aerospace industry, retail and community businesses", businessType: "aerospace and community businesses" },
    }
  },

  {
    primaryCity: "Bath",
    coreAreas: ["Keynsham","Radstock","Midsomer Norton","Frome","Trowbridge","Melksham","Bradford-on-Avon","Westbury","Warminster","Corsham","Chippenham","Calne","Devizes","Marlborough","Shepton Mallet"],
    priorityAreas: ["Bradford-on-Avon","Frome","Corsham","Chippenham","Keynsham"],
    areaProfiles: {
      "Keynsham":          { character: "Avon market town between Bath and Bristol", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
      "Radstock":          { character: "former Somerset coalfield town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Midsomer Norton":   { character: "Somerset market town near Radstock", knownFor: "community services, retail and local trades", businessType: "community and trades businesses" },
      "Frome":             { character: "creative Somerset market town", knownFor: "independent retail, arts and creative businesses", businessType: "independent and creative businesses" },
      "Trowbridge":        { character: "Wiltshire county town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Melksham":          { character: "Wiltshire market town", knownFor: "community services, trades and local retail", businessType: "community and trades businesses" },
      "Bradford-on-Avon":  { character: "beautiful Wiltshire Saxon town", knownFor: "independent retail, premium services and lifestyle businesses", businessType: "premium and independent businesses" },
      "Westbury":          { character: "west Wiltshire market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Warminster":        { character: "west Wiltshire army garrison town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Corsham":           { character: "north Wiltshire Cotswold town", knownFor: "independent businesses, arts and community services", businessType: "independent and creative businesses" },
      "Chippenham":        { character: "north Wiltshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Calne":             { character: "north Wiltshire market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Devizes":           { character: "central Wiltshire market town", knownFor: "independent retail, community services and heritage businesses", businessType: "independent and community businesses" },
      "Marlborough":       { character: "north Wiltshire market town with famous high street", knownFor: "independent retail, premium services and quality businesses", businessType: "premium and independent businesses" },
      "Shepton Mallet":    { character: "Somerset market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Milton Keynes",
    coreAreas: ["Bletchley","Newport Pagnell","Olney","Woburn Sands","Buckingham","Towcester","Stony Stratford","Wolverton","Westcroft","Shenley Brook End","Monkston","Central Milton Keynes","Campbell Park","Walnut Tree","Emerson Valley"],
    priorityAreas: ["Newport Pagnell","Buckingham","Stony Stratford","Woburn Sands","Olney"],
    areaProfiles: {
      "Bletchley":           { character: "south Milton Keynes historic town and suburb", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Newport Pagnell":     { character: "north Milton Keynes historic market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Olney":               { character: "north Buckinghamshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Woburn Sands":        { character: "south Milton Keynes commuter village", knownFor: "independent businesses, community services and quality trades", businessType: "independent and community businesses" },
      "Buckingham":          { character: "north Buckinghamshire county town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Towcester":           { character: "south Northamptonshire market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Stony Stratford":     { character: "north Milton Keynes historic market town", knownFor: "independent retail, arts and community businesses", businessType: "independent and creative businesses" },
      "Wolverton":           { character: "north Milton Keynes railway heritage town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Westcroft":           { character: "south-west Milton Keynes residential grid square", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
      "Shenley Brook End":   { character: "south Milton Keynes residential area", knownFor: "family services, local businesses and community trades", businessType: "family and community businesses" },
      "Monkston":            { character: "east Milton Keynes residential area", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
      "Central Milton Keynes":{ character: "purpose-built city centre retail and business hub", knownFor: "retail, professional services and corporate businesses", businessType: "retail and corporate businesses" },
      "Campbell Park":       { character: "central Milton Keynes mixed-use area", knownFor: "professional services, hospitality and community businesses", businessType: "professional and hospitality businesses" },
      "Walnut Tree":         { character: "south-east Milton Keynes residential suburb", knownFor: "family services, local businesses and community trades", businessType: "family and community businesses" },
      "Emerson Valley":      { character: "south Milton Keynes residential district", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Ipswich",
    coreAreas: ["Woodbridge","Felixstowe","Stowmarket","Hadleigh","Needham Market","Framlingham","Eye","Saxmundham","Leiston","Halesworth","Debenham","Claydon","Bramford","Kesgrave","Martlesham"],
    priorityAreas: ["Woodbridge","Felixstowe","Stowmarket","Kesgrave","Hadleigh"],
    areaProfiles: {
      "Woodbridge":    { character: "attractive east Suffolk market town on the Deben", knownFor: "independent retail, sailing and lifestyle businesses", businessType: "independent and lifestyle businesses" },
      "Felixstowe":    { character: "Suffolk container port and coastal resort", knownFor: "port logistics, seaside businesses and community services", businessType: "port, logistics and community businesses" },
      "Stowmarket":    { character: "mid-Suffolk market town", knownFor: "retail, community services and local trades", businessType: "retail and community businesses" },
      "Hadleigh":      { character: "south Suffolk wool town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Needham Market":{ character: "mid-Suffolk market town", knownFor: "community services, local businesses and quality trades", businessType: "community and independent businesses" },
      "Framlingham":   { character: "east Suffolk castle town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Eye":           { character: "north Suffolk market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Saxmundham":    { character: "east Suffolk market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Leiston":       { character: "east Suffolk town near Sizewell", knownFor: "energy industry links, community services and local trades", businessType: "energy and community businesses" },
      "Halesworth":    { character: "north Suffolk market town", knownFor: "independent retail, arts and community businesses", businessType: "independent and creative businesses" },
      "Debenham":      { character: "mid-Suffolk village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Claydon":       { character: "north Ipswich village suburb", knownFor: "community services, local businesses and family trades", businessType: "family and community businesses" },
      "Bramford":      { character: "north-west Ipswich village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Kesgrave":      { character: "east Ipswich residential suburb", knownFor: "professional services, family businesses and quality trades", businessType: "professional and family businesses" },
      "Martlesham":    { character: "east Ipswich tech park village", knownFor: "tech, professional services and family businesses", businessType: "tech and professional businesses" },
    }
  },

  {
    primaryCity: "Gloucester",
    coreAreas: ["Cheltenham","Stroud","Cirencester","Tewkesbury","Nailsworth","Dursley","Lydney","Coleford","Cinderford","Newent","Mitcheldean","Brockworth","Hucclecote","Churchdown","Longlevens"],
    priorityAreas: ["Cheltenham","Stroud","Cirencester","Tewkesbury","Churchdown"],
    areaProfiles: {
      "Cheltenham":    { character: "elegant Regency spa town north of Gloucester", knownFor: "premium retail, professional services and festival culture", businessType: "premium, professional and cultural businesses" },
      "Stroud":        { character: "Five Valleys creative and independent town", knownFor: "independent retail, arts and sustainable businesses", businessType: "independent, creative and sustainable businesses" },
      "Cirencester":   { character: "Cotswold capital market town", knownFor: "independent retail, professional services and premium businesses", businessType: "premium and independent businesses" },
      "Tewkesbury":    { character: "medieval Cotswold edge market town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Nailsworth":    { character: "Five Valleys independent market town", knownFor: "independent businesses, food and lifestyle services", businessType: "independent and lifestyle businesses" },
      "Dursley":       { character: "Cotswold edge market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Lydney":        { character: "Forest of Dean market town", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Coleford":      { character: "Forest of Dean market town", knownFor: "community services, trades and tourism businesses", businessType: "community and tourism businesses" },
      "Cinderford":    { character: "Forest of Dean former mining town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Newent":        { character: "north Gloucestershire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Mitcheldean":   { character: "Forest of Dean village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Brockworth":    { character: "south-east Gloucester suburban area", knownFor: "community services, retail parks and trades businesses", businessType: "retail and community businesses" },
      "Hucclecote":    { character: "south-east Gloucester residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Churchdown":    { character: "north-east Gloucester commuter suburb near airport", knownFor: "professional services, community businesses and family trades", businessType: "professional and family businesses" },
      "Longlevens":    { character: "north Gloucester residential suburb", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Swindon",
    coreAreas: ["Chippenham","Calne","Marlborough","Wootton Bassett","Wroughton","Highworth","Faringdon","Cirencester","Trowbridge","Melksham","Purton","Cricklade","Lyneham","Stratton St Margaret","Freshbrook"],
    priorityAreas: ["Chippenham","Wootton Bassett","Highworth","Marlborough","Cirencester"],
    areaProfiles: {
      "Chippenham":          { character: "north Wiltshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Calne":               { character: "north Wiltshire market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Marlborough":         { character: "Wiltshire high-street market town", knownFor: "premium independent retail and quality services", businessType: "premium and independent businesses" },
      "Wootton Bassett":     { character: "popular Wiltshire market town near RAF Lyneham", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
      "Wroughton":           { character: "south Swindon village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Highworth":           { character: "north Wiltshire hilltop market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Faringdon":           { character: "Vale of White Horse market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Cirencester":         { character: "Cotswold capital market town", knownFor: "independent retail, professional services and premium businesses", businessType: "premium and independent businesses" },
      "Trowbridge":          { character: "Wiltshire county town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Melksham":            { character: "Wiltshire market town", knownFor: "community services, trades and local retail", businessType: "community and trades businesses" },
      "Purton":              { character: "north Wiltshire village near Swindon", knownFor: "community services, local businesses and quality trades", businessType: "community and independent businesses" },
      "Cricklade":           { character: "north Wiltshire historic town", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Lyneham":             { character: "north Wiltshire RAF village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Stratton St Margaret":{ character: "east Swindon residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Freshbrook":          { character: "west Swindon residential suburb", knownFor: "community services, family businesses and local retail", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Peterborough",
    coreAreas: ["Stamford","Bourne","Market Deeping","Spalding","Huntingdon","Ramsey","Whittlesey","March","Chatteris","Oundle","Thrapston","Yaxley","Crowland","Sawtry","Eye"],
    priorityAreas: ["Stamford","Huntingdon","Market Deeping","Spalding","Oundle"],
    areaProfiles: {
      "Stamford":        { character: "beautiful south Lincolnshire Georgian stone town", knownFor: "premium independent retail and professional services", businessType: "premium and professional businesses" },
      "Bourne":          { character: "south Lincolnshire market town", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Market Deeping":  { character: "Lincolnshire market town", knownFor: "community services, local retail and trades", businessType: "community and trades businesses" },
      "Spalding":        { character: "Lincolnshire flower-growing market town", knownFor: "agricultural, community and retail businesses", businessType: "agricultural and community businesses" },
      "Huntingdon":      { character: "Cambridgeshire county town", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Ramsey":          { character: "Cambridgeshire Fenland market town", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Whittlesey":      { character: "Cambridgeshire Fenland market town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "March":           { character: "Cambridgeshire Fenland market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Chatteris":       { character: "Cambridgeshire Fenland town", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Oundle":          { character: "north Northamptonshire stone market town", knownFor: "independent retail, quality services and community businesses", businessType: "independent and quality businesses" },
      "Thrapston":       { character: "north Northamptonshire market town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Yaxley":          { character: "south Peterborough village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Crowland":        { character: "south Lincolnshire Fenland abbey town", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Sawtry":          { character: "Cambridgeshire A1 commuter village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Eye":             { character: "north Peterborough village suburb", knownFor: "community services, industrial and local businesses", businessType: "industrial and community businesses" },
    }
  },

  {
    primaryCity: "Northampton",
    coreAreas: ["Wellingborough","Kettering","Corby","Rushden","Daventry","Towcester","Brackley","Oundle","Desborough","Rothwell","Burton Latimer","Irthlingborough","Higham Ferrers","Finedon","Duston"],
    priorityAreas: ["Kettering","Wellingborough","Corby","Daventry","Rushden"],
    areaProfiles: {
      "Wellingborough":  { character: "Nene Valley market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Kettering":       { character: "north Northamptonshire market town", knownFor: "retail, community services and professional businesses", businessType: "retail and professional businesses" },
      "Corby":           { character: "north Northamptonshire new town with Scottish heritage", knownFor: "industrial, community and retail businesses", businessType: "industrial and community businesses" },
      "Rushden":         { character: "east Northamptonshire shoe-making town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Daventry":        { character: "west Northamptonshire market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Towcester":       { character: "south Northamptonshire market town with racecourse", knownFor: "community services, independent retail and quality businesses", businessType: "independent and community businesses" },
      "Brackley":        { character: "south Northamptonshire market town with F1 links", knownFor: "motorsport, independent retail and professional businesses", businessType: "motorsport, professional and independent businesses" },
      "Oundle":          { character: "north Northamptonshire public school town", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "Desborough":      { character: "north Northamptonshire market town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Rothwell":        { character: "north Northamptonshire market town", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Burton Latimer":  { character: "Nene Valley suburb of Kettering", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Irthlingborough": { character: "Nene Valley small town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Higham Ferrers":  { character: "Nene Valley historic market town", knownFor: "independent businesses, community services and quality trades", businessType: "independent and community businesses" },
      "Finedon":         { character: "north Northamptonshire village town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Duston":          { character: "west Northampton suburban area", knownFor: "community services, local retail and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Barnsley",
    coreAreas: ["Worsbrough","Penistone","Royston","Cudworth","Hoyland","Wombwell","Wath-upon-Dearne","Mexborough","Chapeltown","Dodworth","Darton","Mapplewell","Grimethorpe","Goldthorpe","Thurnscoe"],
    priorityAreas: ["Penistone","Worsbrough","Hoyland","Royston","Wombwell"],
    areaProfiles: {
      "Worsbrough":     { character: "south Barnsley community area", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Penistone":      { character: "Pennine market town west of Barnsley", knownFor: "independent retail, community services and quality trades", businessType: "independent and community businesses" },
      "Royston":        { character: "north Barnsley former mining community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Cudworth":       { character: "north Barnsley residential area", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Hoyland":        { character: "south Barnsley community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Wombwell":       { character: "south Barnsley former mining community", knownFor: "community services, local trades and retail", businessType: "community and trades businesses" },
      "Wath-upon-Dearne":{ character: "Dearne Valley community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Mexborough":     { character: "Dearne Valley river town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Chapeltown":     { character: "south Yorkshire commuter town", knownFor: "community services, professional businesses and trades", businessType: "professional and community businesses" },
      "Dodworth":       { character: "west Barnsley residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Darton":         { character: "north-west Barnsley residential area", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
      "Mapplewell":     { character: "north Barnsley village suburb", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Grimethorpe":    { character: "north Barnsley former colliery community", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Goldthorpe":     { character: "Dearne Valley community town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Thurnscoe":      { character: "Dearne Valley residential area", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Doncaster",
    coreAreas: ["Bentley","Adwick","Armthorpe","Conisbrough","Mexborough","Tickhill","Bawtry","Thorne","Hatfield","Askern","Rossington","Stainforth","Edlington","Balby","Bessacarr"],
    priorityAreas: ["Tickhill","Bawtry","Bessacarr","Conisbrough","Armthorpe"],
    areaProfiles: {
      "Bentley":      { character: "north Doncaster residential community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Adwick":       { character: "north Doncaster community area", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Armthorpe":    { character: "east Doncaster residential suburb", knownFor: "community services, family businesses and trades", businessType: "family and community businesses" },
      "Conisbrough":  { character: "Dearne Valley castle town", knownFor: "community services, trades and heritage businesses", businessType: "community and heritage businesses" },
      "Mexborough":   { character: "Dearne Valley river town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Tickhill":     { character: "south Doncaster historic village", knownFor: "independent businesses, quality services and community trades", businessType: "independent and quality businesses" },
      "Bawtry":       { character: "south Doncaster Georgian market town", knownFor: "premium independent retail and professional services", businessType: "premium and professional businesses" },
      "Thorne":       { character: "east Doncaster market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Hatfield":     { character: "east Doncaster community area", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Askern":       { character: "north Doncaster former spa town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Rossington":   { character: "south-east Doncaster village suburb", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Stainforth":   { character: "north Doncaster community area", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Edlington":    { character: "west Doncaster community area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Balby":        { character: "south Doncaster residential area", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Bessacarr":    { character: "south-east Doncaster affluent residential suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
    }
  },

  {
    primaryCity: "Wakefield",
    coreAreas: ["Pontefract","Castleford","Featherstone","Ossett","Horbury","Normanton","Knottingley","Hemsworth","South Elmsall","Ackworth","Crofton","Outwood","Stanley","Sandal","Agbrigg"],
    priorityAreas: ["Pontefract","Ossett","Horbury","Castleford","Sandal"],
    areaProfiles: {
      "Pontefract":     { character: "West Yorkshire liquorice and castle heritage town", knownFor: "community services, retail and independent businesses", businessType: "community and independent businesses" },
      "Castleford":     { character: "Airedale mining heritage town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Featherstone":   { character: "West Yorkshire former mining community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Ossett":         { character: "west Wakefield market town", knownFor: "community services, independent businesses and quality trades", businessType: "independent and community businesses" },
      "Horbury":        { character: "south-west Wakefield commuter village", knownFor: "community services, quality trades and independent businesses", businessType: "quality and community businesses" },
      "Normanton":      { character: "central Wakefield former mining town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Knottingley":    { character: "eastern Wakefield riverside town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Hemsworth":      { character: "south Wakefield former coalfield community", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "South Elmsall":  { character: "south Wakefield community area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Ackworth":       { character: "south Wakefield village suburb", knownFor: "community services, quality trades and independent businesses", businessType: "quality and community businesses" },
      "Crofton":        { character: "south Wakefield residential village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Outwood":        { character: "north-east Wakefield residential suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Stanley":        { character: "north-east Wakefield mining heritage area", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Sandal":         { character: "south Wakefield castle suburb", knownFor: "community services, quality businesses and professional trades", businessType: "quality and professional businesses" },
      "Agbrigg":        { character: "south Wakefield residential area", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Carlisle",
    coreAreas: ["Penrith","Brampton","Wigton","Longtown","Alston","Cockermouth","Keswick","Maryport","Whitehaven","Workington","Barrow-in-Furness","Ulverston","Kendal","Windermere","Ambleside"],
    priorityAreas: ["Penrith","Keswick","Kendal","Cockermouth","Windermere"],
    areaProfiles: {
      "Penrith":        { character: "Eden Valley gateway market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Brampton":       { character: "east Cumbria market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Wigton":         { character: "north Cumbria market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Longtown":       { character: "north Cumbria border town", knownFor: "community services, agricultural and trades businesses", businessType: "agricultural and community businesses" },
      "Alston":         { character: "North Pennines market town", knownFor: "community services, tourism and independent businesses", businessType: "tourism and community businesses" },
      "Cockermouth":    { character: "west Cumbrian market town birthplace of Wordsworth", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Keswick":        { character: "Lake District tourist market town", knownFor: "tourism, outdoor retail and hospitality businesses", businessType: "tourism and hospitality businesses" },
      "Maryport":       { character: "west Cumbrian harbour town", knownFor: "community services, maritime and trades businesses", businessType: "maritime and community businesses" },
      "Whitehaven":     { character: "west Cumbrian harbour and market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Workington":     { character: "west Cumbrian industrial town", knownFor: "community services, industrial and trades businesses", businessType: "industrial and community businesses" },
      "Barrow-in-Furness":{ character: "south Cumbrian submarine-building town", knownFor: "industrial, defence and community businesses", businessType: "industrial and community businesses" },
      "Ulverston":      { character: "south Cumbrian Furness market town", knownFor: "independent retail, festivals and community businesses", businessType: "independent and community businesses" },
      "Kendal":         { character: "south Cumbrian Mint Cake market town", knownFor: "independent retail, outdoor businesses and professional services", businessType: "independent and outdoor lifestyle businesses" },
      "Windermere":     { character: "Lake District's largest lake tourist town", knownFor: "tourism, hospitality and outdoor lifestyle businesses", businessType: "tourism and lifestyle businesses" },
      "Ambleside":      { character: "Lake District fell-walking village", knownFor: "tourism, outdoor retail and hospitality businesses", businessType: "tourism and outdoor businesses" },
    }
  },

  {
    primaryCity: "Guildford",
    coreAreas: ["Woking","Farnham","Godalming","Haslemere","Cranleigh","Dorking","Leatherhead","Epsom","Esher","Cobham","Camberley","Fleet","Aldershot","Farnborough","Alton"],
    priorityAreas: ["Woking","Farnham","Godalming","Dorking","Leatherhead"],
    areaProfiles: {
      "Woking":     { character: "busy Surrey commercial town", knownFor: "professional services, retail and corporate businesses", businessType: "professional and corporate businesses" },
      "Farnham":    { character: "attractive west Surrey market town", knownFor: "independent retail, professional services and arts businesses", businessType: "independent and professional businesses" },
      "Godalming":  { character: "prosperous south Surrey market town", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Haslemere":  { character: "west Surrey/north Hampshire border town", knownFor: "independent retail, premium services and community businesses", businessType: "premium and independent businesses" },
      "Cranleigh":  { character: "largest English village in Surrey", knownFor: "independent retail, community services and premium businesses", businessType: "premium and community businesses" },
      "Dorking":    { character: "Surrey Hills market town", knownFor: "independent retail, professional services and lifestyle businesses", businessType: "independent and lifestyle businesses" },
      "Leatherhead":{ character: "north Surrey commuter and commercial town", knownFor: "professional services, corporate businesses and retail", businessType: "professional and corporate businesses" },
      "Epsom":      { character: "north Surrey racecourse town", knownFor: "professional services, independent retail and quality businesses", businessType: "professional and independent businesses" },
      "Esher":      { character: "north Surrey affluent commuter town", knownFor: "premium retail, professional services and lifestyle businesses", businessType: "premium and lifestyle businesses" },
      "Cobham":     { character: "north Surrey affluent village", knownFor: "premium retail, professional services and luxury businesses", businessType: "luxury and professional businesses" },
      "Camberley":  { character: "north Surrey military town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Fleet":      { character: "north Hampshire commuter town", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Aldershot":  { character: "north Hampshire army garrison town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Farnborough":{ character: "north Hampshire aerospace town", knownFor: "aerospace, tech and professional service businesses", businessType: "aerospace and professional businesses" },
      "Alton":      { character: "east Hampshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
    }
  },

  {
    primaryCity: "Worcester",
    coreAreas: ["Droitwich","Kidderminster","Bromsgrove","Redditch","Evesham","Pershore","Upton upon Severn","Great Malvern","Ledbury","Ross-on-Wye","Tenbury Wells","Bewdley","Stourport-on-Severn","Hartlebury","Fernhill Heath"],
    priorityAreas: ["Great Malvern","Kidderminster","Bromsgrove","Droitwich","Evesham"],
    areaProfiles: {
      "Droitwich":          { character: "north Worcestershire spa market town", knownFor: "community services, independent retail and professional businesses", businessType: "independent and professional businesses" },
      "Kidderminster":      { character: "north Worcestershire carpet heritage town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Bromsgrove":         { character: "north Worcestershire market town", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Redditch":           { character: "north Worcestershire new town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Evesham":            { character: "Vale of Evesham market town", knownFor: "agricultural, independent retail and community businesses", businessType: "agricultural and independent businesses" },
      "Pershore":           { character: "Vale of Evesham historic market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and quality businesses" },
      "Upton upon Severn":  { character: "south Worcestershire Severn riverside town", knownFor: "tourism, community services and independent businesses", businessType: "tourism and independent businesses" },
      "Great Malvern":      { character: "Malvern Hills Victorian spa town", knownFor: "independent retail, premium services and lifestyle businesses", businessType: "premium and lifestyle businesses" },
      "Ledbury":            { character: "Herefordshire market town", knownFor: "independent retail, arts and community businesses", businessType: "independent and creative businesses" },
      "Ross-on-Wye":        { character: "Herefordshire Wye Valley market town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Tenbury Wells":      { character: "Worcestershire hop-growing spa town", knownFor: "community services, agricultural and independent businesses", businessType: "agricultural and community businesses" },
      "Bewdley":            { character: "north Worcestershire Georgian riverside town", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Stourport-on-Severn":{ character: "north Worcestershire canal junction town", knownFor: "tourism, community services and trades businesses", businessType: "tourism and community businesses" },
      "Hartlebury":         { character: "north Worcestershire village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Fernhill Heath":     { character: "north Worcester residential village suburb", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Lincoln",
    coreAreas: ["Sleaford","Grantham","Gainsborough","Market Rasen","Horncastle","Louth","Boston","Skegness","Spalding","Bourne","Newark-on-Trent","Retford","Worksop","Mansfield","Sutton-in-Ashfield"],
    priorityAreas: ["Grantham","Newark-on-Trent","Sleaford","Louth","Gainsborough"],
    areaProfiles: {
      "Sleaford":          { character: "north Lincolnshire market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Grantham":          { character: "Lincolnshire market town birthplace of Margaret Thatcher", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Gainsborough":      { character: "west Lincolnshire riverside market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Market Rasen":      { character: "Lincolnshire Wolds market town", knownFor: "community services, independent retail and quality trades", businessType: "independent and community businesses" },
      "Horncastle":        { character: "Lincolnshire Wolds antiques market town", knownFor: "antiques, independent retail and community businesses", businessType: "independent and community businesses" },
      "Louth":             { character: "Lincolnshire Wolds market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and quality businesses" },
      "Boston":            { character: "Lincolnshire Fens market town and port", knownFor: "agricultural, community and retail businesses", businessType: "agricultural and community businesses" },
      "Skegness":          { character: "Lincolnshire coastal resort", knownFor: "tourism, seaside and community businesses", businessType: "tourism and community businesses" },
      "Spalding":          { character: "Lincolnshire flower-growing market town", knownFor: "agricultural, community and retail businesses", businessType: "agricultural and community businesses" },
      "Bourne":            { character: "south Lincolnshire market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Newark-on-Trent":   { character: "Nottinghamshire Civil War heritage town", knownFor: "independent retail, antiques and community businesses", businessType: "independent and heritage businesses" },
      "Retford":           { character: "north Nottinghamshire market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Worksop":           { character: "north Nottinghamshire Sherwood Forest gateway town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Mansfield":         { character: "north Nottinghamshire market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Sutton-in-Ashfield":{ character: "north Nottinghamshire former mining town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Luton",
    coreAreas: ["Dunstable","Leighton Buzzard","Harpenden","St Albans","Hemel Hempstead","Watford","Hitchin","Letchworth","Stevenage","Welwyn Garden City","Hatfield","Hertford","Ware","Baldock","Biggleswade"],
    priorityAreas: ["St Albans","Harpenden","Hitchin","Letchworth","Dunstable"],
    areaProfiles: {
      "Dunstable":          { character: "south Bedfordshire market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Leighton Buzzard":   { character: "south Bedfordshire market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Harpenden":          { character: "affluent Hertfordshire commuter town", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "St Albans":          { character: "historic Hertfordshire cathedral city", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "Hemel Hempstead":    { character: "Hertfordshire new town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Watford":            { character: "south Hertfordshire commercial town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Hitchin":            { character: "north Hertfordshire market town", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Letchworth":         { character: "world's first garden city", knownFor: "community businesses, independent retail and professional services", businessType: "independent and professional businesses" },
      "Stevenage":          { character: "first British new town in Hertfordshire", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Welwyn Garden City": { character: "second garden city in Hertfordshire", knownFor: "professional services, community businesses and retail", businessType: "professional and community businesses" },
      "Hatfield":           { character: "Hertfordshire aerospace heritage town", knownFor: "aerospace, professional services and retail businesses", businessType: "professional and retail businesses" },
      "Hertford":           { character: "Hertfordshire county town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Ware":               { character: "east Hertfordshire market town on the Lea", knownFor: "community services, independent retail and quality businesses", businessType: "independent and community businesses" },
      "Baldock":            { character: "north Hertfordshire market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Biggleswade":        { character: "central Bedfordshire market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
    }
  },

  // ── WALES ──────────────────────────────────────────────────────────────────

  {
    primaryCity: "Cardiff",
    coreAreas: ["Penarth","Barry","Pontypridd","Caerphilly","Newport","Bridgend","Cowbridge","Llantrisant","Tongwynlais","Whitchurch","Roath","Canton","Pontcanna","Cathays","Llandaff"],
    priorityAreas: ["Penarth","Pontypridd","Caerphilly","Cowbridge","Whitchurch"],
    areaProfiles: {
      "Penarth":      { character: "coastal Victorian resort suburb south of Cardiff", knownFor: "independent retail, lifestyle businesses and professional services", businessType: "independent and lifestyle businesses" },
      "Barry":        { character: "Vale of Glamorgan coastal resort and port town", knownFor: "community services, retail and trades businesses", businessType: "retail and community businesses" },
      "Pontypridd":   { character: "Rhondda gateway market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Caerphilly":   { character: "castle town north of Cardiff", knownFor: "community services, retail and independent businesses", businessType: "community and independent businesses" },
      "Newport":      { character: "south Wales city on the Usk", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Bridgend":     { character: "south Wales market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Cowbridge":    { character: "affluent Vale of Glamorgan market town", knownFor: "premium independent retail and professional services", businessType: "premium and professional businesses" },
      "Llantrisant":  { character: "Royal Mint town in the Valleys gateway", knownFor: "professional services, community businesses and trades", businessType: "professional and community businesses" },
      "Tongwynlais":  { character: "north Cardiff castle village suburb", knownFor: "community services, local businesses and trades", businessType: "community and independent businesses" },
      "Whitchurch":   { character: "north Cardiff residential suburb", knownFor: "professional services, quality retail and community businesses", businessType: "professional and community businesses" },
      "Roath":        { character: "inner east Cardiff residential area", knownFor: "independent businesses, student services and community retail", businessType: "independent and community businesses" },
      "Canton":       { character: "west Cardiff residential suburb", knownFor: "independent businesses, cafés and community services", businessType: "independent and community businesses" },
      "Pontcanna":    { character: "affluent west Cardiff village suburb", knownFor: "boutique businesses, independent retail and professional services", businessType: "boutique and professional businesses" },
      "Cathays":      { character: "Cardiff student and civic area", knownFor: "student services, independent retail and community businesses", businessType: "student-facing and community businesses" },
      "Llandaff":     { character: "west Cardiff cathedral village suburb", knownFor: "quality retail, professional services and community businesses", businessType: "professional and quality businesses" },
    }
  },

  {
    primaryCity: "Swansea",
    coreAreas: ["Neath","Port Talbot","Llanelli","Ammanford","Pontardawe","Gorseinon","Loughor","Mumbles","Sketty","Uplands","Morriston","Clydach","Ystalyfera","Pontarddulais","Gowerton"],
    priorityAreas: ["Mumbles","Sketty","Neath","Llanelli","Gorseinon"],
    areaProfiles: {
      "Neath":         { character: "west Glamorgan market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Port Talbot":   { character: "west Glamorgan steeltown", knownFor: "industrial, community services and trades businesses", businessType: "industrial and community businesses" },
      "Llanelli":      { character: "west Wales Scarlets rugby town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Ammanford":     { character: "Amman Valley market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Pontardawe":    { character: "Swansea Valley town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Gorseinon":     { character: "west Swansea suburban town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Loughor":       { character: "west Swansea estuary community", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Mumbles":       { character: "Gower peninsula coastal village and resort", knownFor: "independent businesses, restaurants and lifestyle services", businessType: "independent and lifestyle businesses" },
      "Sketty":        { character: "west Swansea residential suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Uplands":       { character: "inner west Swansea student and residential area", knownFor: "independent businesses, community services and cafés", businessType: "independent and community businesses" },
      "Morriston":     { character: "north Swansea suburban area", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Clydach":       { character: "Swansea Valley nickel-town suburb", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Ystalyfera":    { character: "upper Swansea Valley community town", knownFor: "community services, local trades and Welsh-language businesses", businessType: "community and trades businesses" },
      "Pontarddulais": { character: "gateway Gower border town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Gowerton":      { character: "west Swansea Gower gateway suburb", knownFor: "community services, local businesses and trades", businessType: "community and independent businesses" },
    }
  },

  {
    primaryCity: "Newport",
    coreAreas: ["Cwmbran","Pontypool","Abergavenny","Monmouth","Chepstow","Caerleon","Risca","Blackwood","Bargoed","Abertillery","Ebbw Vale","Merthyr Tydfil","Tredegar","Aberdare","Mountain Ash"],
    priorityAreas: ["Cwmbran","Abergavenny","Monmouth","Chepstow","Caerleon"],
    areaProfiles: {
      "Cwmbran":       { character: "Torfaen new town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Pontypool":     { character: "Torfaen industrial heritage town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Abergavenny":   { character: "gateway to the Brecon Beacons market town", knownFor: "independent retail, food festivals and professional services", businessType: "independent and food businesses" },
      "Monmouth":      { character: "south-east Wales historic market town", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Chepstow":      { character: "Wales-England border castle town on the Wye", knownFor: "independent retail, tourism and community businesses", businessType: "independent and tourism businesses" },
      "Caerleon":      { character: "Newport Roman fortress village", knownFor: "tourism, independent businesses and community services", businessType: "tourism and independent businesses" },
      "Risca":         { character: "south Wales Valley community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Blackwood":     { character: "Gwent Valley market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Bargoed":       { character: "Caerphilly county borough Valley town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Abertillery":   { character: "Blaenau Gwent Valley community town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Ebbw Vale":     { character: "Blaenau Gwent steeltown", knownFor: "community services, regeneration businesses and trades", businessType: "community and regeneration businesses" },
      "Merthyr Tydfil":{ character: "Valleys iron heritage town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Tredegar":      { character: "Blaenau Gwent market town birthplace of Aneurin Bevan", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Aberdare":      { character: "Cynon Valley market town", knownFor: "community services, retail and trades businesses", businessType: "community and trades businesses" },
      "Mountain Ash":  { character: "Cynon Valley community town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Wrexham",
    coreAreas: ["Llangollen","Chirk","Ruabon","Rhosllanerchrugog","Cefn Mawr","Johnstown","Acrefair","Coedpoeth","Llay","Gresford","Rossett","Borras","Erddig","Holt","Overton"],
    priorityAreas: ["Llangollen","Gresford","Rossett","Coedpoeth","Chirk"],
    areaProfiles: {
      "Llangollen":           { character: "Dee Valley international eisteddfod town", knownFor: "tourism, independent retail and community businesses", businessType: "tourism and independent businesses" },
      "Chirk":                { character: "north Wales border castle village", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Ruabon":               { character: "north Wales industrial heritage village", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Rhosllanerchrugog":    { character: "former north Wales coalfield community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Cefn Mawr":            { character: "Dee Valley aqueduct community", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Johnstown":            { character: "south Wrexham suburban village", knownFor: "community services, local trades and family businesses", businessType: "family and community businesses" },
      "Acrefair":             { character: "Cefn Mawr village community", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Coedpoeth":            { character: "west Wrexham residential village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Llay":                 { character: "north Wrexham residential village", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
      "Gresford":             { character: "north Wrexham commuter village", knownFor: "community services, quality businesses and local trades", businessType: "quality and community businesses" },
      "Rossett":              { character: "north Wrexham border commuter village", knownFor: "community services, professional businesses and quality trades", businessType: "professional and quality businesses" },
      "Borras":               { character: "east Wrexham residential suburb", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
      "Erddig":               { character: "south Wrexham National Trust estate area", knownFor: "tourism, community services and local businesses", businessType: "tourism and community businesses" },
      "Holt":                 { character: "north Wales border village", knownFor: "community services, quality businesses and local trades", businessType: "community and independent businesses" },
      "Overton":              { character: "north Wales border village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
    }
  },

  // ── SCOTLAND ───────────────────────────────────────────────────────────────

  {
    primaryCity: "Glasgow",
    coreAreas: ["Bearsden","Milngavie","Clydebank","Dumbarton","Helensburgh","Paisley","Renfrew","Johnstone","Newton Mearns","Giffnock","Clarkston","Rutherglen","Hamilton","Motherwell","East Kilbride"],
    priorityAreas: ["Bearsden","Newton Mearns","Helensburgh","Giffnock","East Kilbride"],
    areaProfiles: {
      "Bearsden":       { character: "affluent west Dunbartonshire commuter suburb", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "Milngavie":      { character: "east Dunbartonshire commuter village suburb", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Clydebank":      { character: "west Dunbartonshire shipbuilding heritage town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Dumbarton":      { character: "west Dunbartonshire castle rock town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Helensburgh":    { character: "Argyll coastal commuter town on the Clyde", knownFor: "independent retail, professional services and lifestyle businesses", businessType: "independent and lifestyle businesses" },
      "Paisley":        { character: "Renfrewshire town adjacent to Glasgow airport", knownFor: "retail, community services and professional businesses", businessType: "retail and professional businesses" },
      "Renfrew":        { character: "Renfrewshire riverside town near Glasgow Airport", knownFor: "community services, industrial and local businesses", businessType: "industrial and community businesses" },
      "Johnstone":      { character: "Renfrewshire market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Newton Mearns":  { character: "affluent east Renfrewshire commuter suburb", knownFor: "premium retail, professional services and quality businesses", businessType: "premium and professional businesses" },
      "Giffnock":       { character: "east Renfrewshire affluent suburb", knownFor: "quality retail, professional services and lifestyle businesses", businessType: "professional and lifestyle businesses" },
      "Clarkston":      { character: "east Renfrewshire residential suburb", knownFor: "quality retail, professional services and community businesses", businessType: "professional and community businesses" },
      "Rutherglen":     { character: "south Lanarkshire urban town adjacent to Glasgow", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Hamilton":       { character: "south Lanarkshire market town", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Motherwell":     { character: "north Lanarkshire steel heritage town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "East Kilbride":  { character: "Scotland's first new town south of Glasgow", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
    }
  },

  {
    primaryCity: "Edinburgh",
    coreAreas: ["Leith","Musselburgh","Dalkeith","Penicuik","Bonnyrigg","Loanhead","Currie","Balerno","Livingston","Bathgate","Linlithgow","Kirkliston","South Queensferry","Portobello","Morningside"],
    priorityAreas: ["Morningside","Leith","Musselburgh","Portobello","South Queensferry"],
    areaProfiles: {
      "Leith":             { character: "vibrant port district north of Edinburgh", knownFor: "independent restaurants, creative businesses and community services", businessType: "independent and creative businesses" },
      "Musselburgh":       { character: "East Lothian coastal town adjacent to Edinburgh", knownFor: "independent businesses, community services and quality trades", businessType: "independent and community businesses" },
      "Dalkeith":          { character: "Midlothian market town south of Edinburgh", knownFor: "community services, retail and trades businesses", businessType: "retail and community businesses" },
      "Penicuik":          { character: "south Midlothian Esk Valley town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Bonnyrigg":         { character: "south Midlothian residential town", knownFor: "community services, family businesses and local trades", businessType: "family and community businesses" },
      "Loanhead":          { character: "south Midlothian mining heritage suburb", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Currie":            { character: "west Edinburgh Water of Leith village suburb", knownFor: "community services, professional businesses and quality trades", businessType: "professional and community businesses" },
      "Balerno":           { character: "west Edinburgh commuter village suburb", knownFor: "quality businesses, community services and professional trades", businessType: "professional and quality businesses" },
      "Livingston":        { character: "West Lothian new town and retail centre", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Bathgate":          { character: "West Lothian market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Linlithgow":        { character: "West Lothian historic royal burgh", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Kirkliston":        { character: "West Lothian village between Edinburgh and airport", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "South Queensferry": { character: "Forth bridges village suburb west of Edinburgh", knownFor: "tourism, independent businesses and community services", businessType: "tourism and independent businesses" },
      "Portobello":        { character: "east Edinburgh seaside suburb", knownFor: "independent businesses, lifestyle services and community retail", businessType: "independent and lifestyle businesses" },
      "Morningside":       { character: "south Edinburgh affluent residential suburb", knownFor: "independent retail, professional services and premium businesses", businessType: "premium and professional businesses" },
    }
  },

  {
    primaryCity: "Aberdeen",
    coreAreas: ["Westhill","Stonehaven","Inverurie","Ellon","Banchory","Peterhead","Fraserburgh","Huntly","Turriff","Aboyne","Ballater","Braemar","Portlethen","Dyce","Bridge of Don"],
    priorityAreas: ["Westhill","Stonehaven","Inverurie","Ellon","Banchory"],
    areaProfiles: {
      "Westhill":     { character: "affluent Aberdeenshire oil industry commuter suburb", knownFor: "professional services, quality retail and family businesses", businessType: "professional and family businesses" },
      "Stonehaven":   { character: "Aberdeenshire coastal market town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and quality businesses" },
      "Inverurie":    { character: "Aberdeenshire Gordon market town", knownFor: "community services, professional businesses and quality retail", businessType: "professional and community businesses" },
      "Ellon":        { character: "north Aberdeenshire market town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Banchory":     { character: "Aberdeenshire Royal Deeside market town", knownFor: "independent retail, tourism and quality businesses", businessType: "independent and quality businesses" },
      "Peterhead":    { character: "Aberdeenshire port and fishing town", knownFor: "maritime, energy and community businesses", businessType: "maritime and energy businesses" },
      "Fraserburgh":  { character: "north Aberdeenshire fishing port", knownFor: "maritime, community services and trades businesses", businessType: "maritime and community businesses" },
      "Huntly":       { character: "Gordon district market town", knownFor: "community services, independent businesses and trades", businessType: "community and independent businesses" },
      "Turriff":      { character: "north Aberdeenshire market town", knownFor: "agricultural, community and trades businesses", businessType: "agricultural and community businesses" },
      "Aboyne":       { character: "Aberdeenshire Royal Deeside village", knownFor: "tourism, independent businesses and quality services", businessType: "tourism and independent businesses" },
      "Ballater":     { character: "Aberdeenshire Royal Deeside royal village", knownFor: "tourism, premium retail and lifestyle businesses", businessType: "tourism and lifestyle businesses" },
      "Braemar":      { character: "Cairngorms Highland village with royal games", knownFor: "tourism, outdoor retail and community businesses", businessType: "tourism and outdoor businesses" },
      "Portlethen":   { character: "south Aberdeen oil industry suburb", knownFor: "professional services, community businesses and family trades", businessType: "professional and family businesses" },
      "Dyce":         { character: "north Aberdeen airport suburb", knownFor: "aviation, energy and professional businesses", businessType: "aviation and professional businesses" },
      "Bridge of Don":{ character: "north Aberdeen residential suburb", knownFor: "community services, retail and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Dundee",
    coreAreas: ["Perth","Forfar","Arbroath","Montrose","Kirriemuir","Carnoustie","Monifieth","Broughty Ferry","Newport-on-Tay","Tayport","Brechin","Blairgowrie","Alyth","Coupar Angus","Newburgh"],
    priorityAreas: ["Perth","Broughty Ferry","Carnoustie","Arbroath","Blairgowrie"],
    areaProfiles: {
      "Perth":           { character: "Fair City and gateway to the Highlands", knownFor: "independent retail, professional services and quality businesses", businessType: "independent and professional businesses" },
      "Forfar":          { character: "Angus county town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Arbroath":        { character: "Angus coastal fishing town of the Declaration", knownFor: "maritime, community and independent businesses", businessType: "maritime and community businesses" },
      "Montrose":        { character: "Angus oil services coastal town", knownFor: "energy, maritime and community businesses", businessType: "energy and maritime businesses" },
      "Kirriemuir":      { character: "Angus Gateway to the Glens town", knownFor: "independent businesses, tourism and community services", businessType: "independent and tourism businesses" },
      "Carnoustie":      { character: "Angus Open Championship golf links town", knownFor: "tourism, golf and community businesses", businessType: "golf, tourism and community businesses" },
      "Monifieth":       { character: "east Dundee residential commuter suburb", knownFor: "community services, local businesses and quality trades", businessType: "community and quality businesses" },
      "Broughty Ferry":  { character: "affluent east Dundee seaside suburb", knownFor: "independent retail, restaurants and professional services", businessType: "independent and professional businesses" },
      "Newport-on-Tay":  { character: "Fife Tay estuary commuter village", knownFor: "community services, quality businesses and local trades", businessType: "quality and community businesses" },
      "Tayport":         { character: "north Fife coastal village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Brechin":         { character: "Angus round-tower cathedral city", knownFor: "community services, independent businesses and trades", businessType: "community and independent businesses" },
      "Blairgowrie":     { character: "Perth and Kinross berry-farming market town", knownFor: "agricultural, independent and community businesses", businessType: "agricultural and independent businesses" },
      "Alyth":           { character: "Perth and Kinross market town", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Coupar Angus":    { character: "Strathmore market town", knownFor: "agricultural, community and trades businesses", businessType: "agricultural and community businesses" },
      "Newburgh":        { character: "south Fife Tay estuary village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
    }
  },

  {
    primaryCity: "Inverness",
    coreAreas: ["Nairn","Forres","Elgin","Keith","Dingwall","Tain","Invergordon","Alness","Beauly","Grantown-on-Spey","Aviemore","Kingussie","Newtonmore","Fort William","Kyle of Lochalsh"],
    priorityAreas: ["Nairn","Aviemore","Fort William","Elgin","Dingwall"],
    areaProfiles: {
      "Nairn":            { character: "Moray coastal golf and beach resort", knownFor: "tourism, independent retail and quality businesses", businessType: "tourism and independent businesses" },
      "Forres":           { character: "Moray royal burgh and garden town", knownFor: "independent retail, community services and quality businesses", businessType: "independent and community businesses" },
      "Elgin":            { character: "Moray cathedral city and market town", knownFor: "independent retail, professional services and community businesses", businessType: "independent and professional businesses" },
      "Keith":            { character: "Moray whisky heritage market town", knownFor: "whisky industry, community services and independent businesses", businessType: "whisky, community and independent businesses" },
      "Dingwall":         { character: "Ross-shire county town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Tain":             { character: "Easter Ross royal burgh whisky town", knownFor: "whisky industry, community services and independent businesses", businessType: "whisky and community businesses" },
      "Invergordon":      { character: "Easter Ross deep-water port and oil platform town", knownFor: "maritime, energy and community businesses", businessType: "maritime and energy businesses" },
      "Alness":           { character: "Easter Ross community town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Beauly":           { character: "Inverness-shire priory village", knownFor: "tourism, community services and independent businesses", businessType: "tourism and independent businesses" },
      "Grantown-on-Spey": { character: "Speyside planned Georgian market town", knownFor: "tourism, whisky and independent businesses", businessType: "tourism and independent businesses" },
      "Aviemore":         { character: "Cairngorms ski and outdoor adventure resort", knownFor: "outdoor tourism, hospitality and lifestyle businesses", businessType: "tourism and outdoor lifestyle businesses" },
      "Kingussie":        { character: "Badenoch highland village", knownFor: "tourism, community services and independent businesses", businessType: "tourism and community businesses" },
      "Newtonmore":       { character: "Badenoch shinty village", knownFor: "community services, tourism and local businesses", businessType: "tourism and community businesses" },
      "Fort William":     { character: "Ben Nevis gateway highland town", knownFor: "outdoor tourism, hospitality and independent businesses", businessType: "tourism and outdoor businesses" },
      "Kyle of Lochalsh": { character: "Skye bridge western highland gateway", knownFor: "tourism, community services and local businesses", businessType: "tourism and community businesses" },
    }
  },

  {
    primaryCity: "Belfast",
    coreAreas: ["Lisburn","Bangor","Newtownabbey","Carrickfergus","Antrim","Ballymena","Larne","Holywood","Newtownards","Downpatrick","Newcastle","Ballynahinch","Dromore","Hillsborough","Carryduff"],
    priorityAreas: ["Lisburn","Bangor","Holywood","Hillsborough","Newtownards"],
    areaProfiles: {
      "Lisburn":       { character: "linen heritage city south-west of Belfast", knownFor: "retail, professional services and community businesses", businessType: "retail and professional businesses" },
      "Bangor":        { character: "Co Down coastal resort and commuter town", knownFor: "independent retail, maritime and lifestyle businesses", businessType: "independent and lifestyle businesses" },
      "Newtownabbey":  { character: "north Belfast suburban borough", knownFor: "retail, community services and professional businesses", businessType: "retail and professional businesses" },
      "Carrickfergus": { character: "Antrim coast castle heritage town", knownFor: "community services, tourism and local businesses", businessType: "tourism and community businesses" },
      "Antrim":        { character: "Co Antrim airport gateway town", knownFor: "professional services, retail and community businesses", businessType: "professional and community businesses" },
      "Ballymena":     { character: "Co Antrim market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Larne":         { character: "Co Antrim port and coastal town", knownFor: "maritime, community services and trades businesses", businessType: "maritime and community businesses" },
      "Holywood":      { character: "Co Down affluent coastal suburb of Belfast", knownFor: "premium independent retail and professional services", businessType: "premium and professional businesses" },
      "Newtownards":   { character: "Co Down Ards Peninsula market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Downpatrick":   { character: "Co Down St Patrick's cathedral heritage town", knownFor: "tourism, community services and independent businesses", businessType: "tourism and community businesses" },
      "Newcastle":     { character: "Co Down Mourne Mountains coastal resort", knownFor: "tourism, outdoor businesses and community services", businessType: "tourism and outdoor businesses" },
      "Ballynahinch":  { character: "Co Down market town", knownFor: "community services, local trades and independent businesses", businessType: "community and independent businesses" },
      "Dromore":       { character: "Co Down cathedral village town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Hillsborough":  { character: "Co Down royal village near Government House", knownFor: "premium independent businesses and quality services", businessType: "premium and independent businesses" },
      "Carryduff":     { character: "south Belfast commuter village suburb", knownFor: "community services, retail and family businesses", businessType: "family and community businesses" },
    }
  },

  {
    primaryCity: "Londonderry",
    coreAreas: ["Limavady","Coleraine","Ballymoney","Ballycastle","Strabane","Omagh","Cookstown","Dungannon","Magherafelt","Maghera","Tobermore","Castledawson","Claudy","Eglinton","Waterside"],
    priorityAreas: ["Coleraine","Limavady","Omagh","Strabane","Waterside"],
    areaProfiles: {
      "Limavady":      { character: "Co Londonderry market town near Binevenagh", knownFor: "community services, independent businesses and quality trades", businessType: "community and independent businesses" },
      "Coleraine":     { character: "Co Londonderry university town on the Bann", knownFor: "retail, student services and professional businesses", businessType: "student, retail and professional businesses" },
      "Ballymoney":    { character: "Co Antrim market town", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Ballycastle":   { character: "Co Antrim coastal heritage town", knownFor: "tourism, community services and independent businesses", businessType: "tourism and independent businesses" },
      "Strabane":      { character: "Co Tyrone border town on the Foyle", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Omagh":         { character: "Co Tyrone market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Cookstown":     { character: "Co Tyrone longest high-street market town", knownFor: "retail, community services and trades businesses", businessType: "retail and community businesses" },
      "Dungannon":     { character: "Co Tyrone market town with linen heritage", knownFor: "community services, trades and local businesses", businessType: "community and trades businesses" },
      "Magherafelt":   { character: "Co Londonderry market town", knownFor: "community services, trades and retail businesses", businessType: "community and trades businesses" },
      "Maghera":       { character: "Co Londonderry village market town", knownFor: "community services, local trades and businesses", businessType: "community and trades businesses" },
      "Tobermore":     { character: "Co Londonderry village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Castledawson":  { character: "Co Londonderry village", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Claudy":        { character: "Co Londonderry village south of Derry", knownFor: "community services, local businesses and trades", businessType: "community and trades businesses" },
      "Eglinton":      { character: "Co Londonderry airport village suburb", knownFor: "community services, local businesses and professional trades", businessType: "professional and community businesses" },
      "Waterside":     { character: "east Londonderry residential suburb on the Foyle", knownFor: "community services, local businesses and independent trades", businessType: "community and independent businesses" },
    }
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// Write files
// ─────────────────────────────────────────────────────────────────────────────

let written = 0;
let skipped = 0;

for (const city of CITIES) {
  const slug = city.primaryCity
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const outPath = path.join(OUT_DIR, `${slug}.json`);

  // Build the JSON object
  const data = {
    primaryCity: city.primaryCity,
    coreAreas: city.coreAreas,
    priorityAreas: city.priorityAreas,
    areaProfiles: city.areaProfiles,
  };

  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  written++;
  process.stdout.write(`  ✓ ${slug}.json\n`);
}

console.log(`\n✅ Done — ${written} city files written to config/areas/`);
