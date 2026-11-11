#!/usr/bin/env python3
"""Build Next Trend Wire post pages from markdown drafts.

Converts bullet-block drafts (intro prose + ## sections + '- **Lead.** text'
bullets) into HTML post pages using posts/anthropic-ipo.html as the template,
preserving its head (GA + Clarity + canonical tags), header, footer and scripts exactly.
The template's own canonical is swapped per post to that post's clean URL.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
POSTS = BASE / "posts"
DRAFTS = BASE / "drafts"

# slug -> (draft file, eyebrow category, eyebrow date, image file, image alt)
PAGES = {
    # Conversions: same slug/image/eyebrow as the live post, body from bullets-v2
    "anthropic-ipo": ("anthropic-ipo-bullets-v2.md", "Technology", "October 27, 2026",
                      "anthropic2.jpg", "Anthropic office building"),
    "nvidia-meta-ai-spending": ("nvidia-meta-ai-spending-bullets-v2.md", "Business", "October 27, 2026",
                                "nvidia.jpg", "Nvidia H200 AI GPU hardware"),
    "trump-iran-strikes-midterms": ("trump-iran-strikes-midterms-bullets-v2.md", "Politics", "October 27, 2026",
                                    "white-house.webp", "The White House in Washington, DC"),
    "ai-ads-midterms-137m": ("ai-ads-midterms-137m-bullets-v2.md", "Politics", "October 27, 2026",
                             "voting.jpg", "A hand casting a vote in front of the US flag"),
    "fed-big-tech-earnings-week": ("fed-big-tech-earnings-week-bullets-v2.md", "Business", "October 27, 2026",
                                   "fed.webp", "Federal Reserve building"),
    "brazil-lula-bolsonaro-exile": ("brazil-lula-bolsonaro-exile-bullets-v2.md", "Politics", "October 28, 2026",
                                    "brazil-lula.webp", "Luiz Inacio Lula da Silva in front of the Brazilian flag"),
    "israel-election-hung-parliament": ("israel-election-hung-parliament-bullets-v2.md", "Politics", "October 28, 2026",
                                        "israel-knesset.jpg", "The Knesset building in Jerusalem"),
    "microsoft-buyouts-60000": ("microsoft-buyouts-60000-bullets-v2.md", "Technology", "October 28, 2026",
                                "microsoft-campus.jpg", "Microsoft campus in Redmond"),
    "trump-venezuela-51st-state": ("trump-venezuela-51st-state-bullets-v2.md", "Politics", "October 28, 2026",
                                   "venezuela-tanker.jpg", "An oil tanker docked at a port"),
    # New posts, October 29, 2026 (Amazon, SNAP, Rio held out: not built here)
    "us-midterms-final-week-polls": ("us-midterms-final-week-polls.md", "Politics", "October 29, 2026",
                                     "us-midterms-final-week-polls.jpg", "Voters and campaign signs in the US midterm elections"),
    "spain-train-collision": ("spain-train-collision.md", "Politics", "October 29, 2026",
                              "spain-train-collision.jpg", "A high-speed train in Spain"),
    "israel-coalition-deadlock": ("israel-coalition-deadlock.md", "Politics", "October 29, 2026",
                                  "israel-coalition-deadlock.jpg", "The Knesset building in Jerusalem"),
    "jio-ipo-listing": ("jio-ipo-listing.md", "Business", "October 29, 2026",
                        "jio-ipo-listing.jpg", "Jio Platforms listing at the stock exchange"),
    "trump-putin-zelensky-meeting": ("trump-putin-zelensky-meeting.md", "Politics", "October 29, 2026",
                                     "trump-putin-zelensky-meeting.jpg", "Donald Trump speaking to reporters"),
    "apple-touchscreen-macbook-pro": ("apple-touchscreen-macbook-pro.md", "Technology", "October 29, 2026",
                                      "apple-touchscreen-macbook-pro.jpg", "Apple MacBook Pro laptop"),
    "russia-africa-summit-moscow": ("russia-africa-summit-moscow.md", "Politics", "October 29, 2026",
                                    "russia-africa-summit-moscow.jpg", "The Kremlin in Moscow"),
    "north-korea-submarine-missile-test": ("north-korea-submarine-missile-test.md", "Politics", "October 29, 2026",
                                           "north-korea-submarine-missile-test.jpg", "A submarine at sea"),
    "rio-police-operation-one-year-later": ("rio-police-operation-64-killed.md", "Politics", "October 29, 2026",
                                            "rio-police-operation-64-killed.jpg", "A favela hillside in Rio de Janeiro"),
    # New posts, October 29, 2026 (Trends batch)
    "brewers-world-series-contreras-mvp": ("brewers-world-series-contreras-mvp.md", "Sports", "October 29, 2026",
                                           "brewers-world-series-contreras-mvp.jpg", "American Family Field in Milwaukee"),
    "google-stock-earnings-reaction": ("google-stock-earnings-reaction.md", "Business", "October 29, 2026",
                                       "google-stock-earnings-reaction.jpg", "Google headquarters campus"),
    "dolores-huerta-dies-96": ("dolores-huerta-dies-96.md", "Politics", "October 29, 2026",
                               "dolores-huerta-dies-96.jpg", "Dolores Huerta"),
    "mavericks-thunder-flagg": ("mavericks-thunder-flagg.md", "Sports", "October 29, 2026",
                                "mavericks-thunder-flagg.jpg", "American Airlines Center in Dallas"),
    "ernie-johnson-inside-nba": ("ernie-johnson-inside-nba.md", "Sports", "October 29, 2026",
                                 "ernie-johnson-inside-nba.jpg", "A basketball arena"),
    "knicks-bulls-brunson-comeback": ("knicks-bulls-brunson-comeback.md", "Sports", "October 29, 2026",
                                      "knicks-bulls-brunson-comeback.jpg", "Madison Square Garden"),
    "sudan-nyala-market-strike": ("sudan-nyala-market-strike.md", "Politics", "October 29, 2026",
                                  "sudan-nyala-market-strike.jpg", "Market vendors in Sudan"),
    "supreme-court-delhi-voter-rolls": ("supreme-court-delhi-voter-rolls.md", "Politics", "October 29, 2026",
                                        "supreme-court-delhi-voter-rolls.jpg", "The Supreme Court of India"),
    "2020-election-search-spike": ("2020-election-search-spike.md", "Politics", "October 29, 2026",
                                   "2020-election-search-spike.jpg", "The United States Capitol"),
    "miyokos-butter-recall": ("miyokos-butter-recall.md", "Health", "October 29, 2026",
                              "miyokos-butter-recall.jpg", "Butter in a dish"),
    # New posts, October 29, 2026 (late night batch)
    "bears-trade-jeffery-simmons": ("bears-trade-jeffery-simmons.md", "Sports", "October 29, 2026",
                                    "bears-trade-jeffery-simmons.jpg", "Jeffery Simmons in a Tennessee Titans uniform"),
    "doordash-buys-instacart-17b": ("doordash-buys-instacart-17b.md", "Business", "October 29, 2026",
                                    "doordash-buys-instacart-17b.jpg", "Instacart grocery bags on a countertop"),
    # Amazon Q3 2026 earnings (short version first, then expanded to full)
    "amazon-q3-2026-earnings": ("amazon-q3-2026-earnings.md", "Business", "October 29, 2026",
                                "amazon-q3-2026.jpg", "The Amazon Spheres at Amazon headquarters in Seattle"),
    # New posts, October 30, 2026 (Trends batch)
    "patrick-stewart-dies-86": ("patrick-stewart-dies-86.md", "Culture", "October 30, 2026",
                                "patrick-stewart-dies-86.jpg", "Patrick Stewart"),
    "binance-6-3-billion-hack": ("binance-6-3-billion-hack.md", "Business", "October 30, 2026",
                                 "binance-hack-6b.jpg", "Binance founder Changpeng Zhao"),
    "packers-watson-hospital-return": ("packers-watson-hospital-return.md", "Sports", "October 30, 2026",
                                       "packers-watson-hospital-return.jpg", "Christian Watson in Green Bay Packers gear"),
    # New posts, October 31, 2026 (Trends batch)
    "intel-q3-2026-earnings": ("intel-q3-2026-earnings.md", "Business", "October 31, 2026",
                              "intel-q3-2026-earnings.jpg", "Intel headquarters in Santa Clara"),
    "reddit-q3-2026-earnings": ("reddit-q3-2026-earnings.md", "Business", "October 31, 2026",
                                "reddit-q3-2026-earnings.jpg", "Reddit CEO Steve Huffman"),
    # New posts, October 31, 2026 (Trends batch)
    "nasdaq-oct30-selloff": ("nasdaq-oct30-selloff.md", "Business", "October 31, 2026",
                              "nasdaq-selloff-oct30.jpg", "Nasdaq MarketSite studio in New York"),
    "poland-tribunal-crisis": ("poland-tribunal-crisis.md", "Politics", "October 31, 2026",
                                "poland-tribunal-crisis.jpg", "The Constitutional Tribunal building in Warsaw"),
    # New posts, October 31, 2026 (Trends batch)
    "mcdonalds-mcrib-lawsuit-proceeds": ("mcdonalds-mcrib-lawsuit-proceeds.md", "Business", "October 31, 2026",
                                         "mcdonalds-mcrib-lawsuit.jpg", "A McRib sandwich (file photo)"),
    "warriors-lakers-historic-comeback": ("warriors-lakers-historic-comeback.md", "Sports", "October 31, 2026",
                                          "warriors-lakers-comeback.jpg", "Stephen Curry shooting in a Golden State Warriors warmup (file photo)"),
    # New posts, October 31, 2026 (Trends batch)
    "richard-norton-peptides-coroner-finding": ("richard-norton-peptides-coroner-finding.md", "Health", "October 31, 2026",
                                                "richard-norton-peptides.jpg", "A prepared injection in a syringe beside a medicine vial (file photo)"),
    "samsung-news-shutdown-december-21": ("samsung-news-shutdown-december-21.md", "Technology", "October 31, 2026",
                                          "samsung-news-shutdown.jpg", "Samsung Galaxy phones on a table (file photo)"),
    # New post, November 1, 2026 (Trends batch)
    "ines-gomez-mont-miami-arrest": ("ines-gomez-mont-miami-arrest.md", "Politics", "November 1, 2026",
                                     "ines-gomez-mont-miami-arrest.jpg", "Miami skyline (file photo)"),
    # New posts, November 1, 2026 (Trends batch)
    "valkyries-first-wnba-title-game-7": ("valkyries-first-wnba-title-game-7.md", "Sports", "November 1, 2026",
                                          "valkyries-first-wnba-title-game-7.jpg", "Gabby Williams playing for Fenerbahçe in January 2025 (file photo)"),
    "daylight-saving-time-ends-november-1-2026": ("daylight-saving-time-ends-november-1-2026.md", "Politics", "November 1, 2026",
                                                  "daylight-saving-time-ends-november-1-2026.jpg", "A classic alarm clock (file photo)"),
    # New posts, November 2, 2026 (Trends + startup lane)
    "northwood-space-series-c": ("northwood-space-series-c.md", "Business", "November 2, 2026",
                                  "northwood-space-series-c.jpg", "Satellite dishes at a ground station (file photo)"),
    # New posts, November 3, 2026 (Trends + startup lane)
    "apple-q4-2026-earnings": ("apple-q4-2026-earnings.md", "Business", "November 3, 2026",
                               "apple-q4-2026-earnings.jpg", "Apple Park in Cupertino (file photo)"),
    "tutor-intelligence-series-b": ("tutor-intelligence-series-b.md", "Business", "November 3, 2026",
                                     "tutor-intelligence-series-b.jpg", "Automated guided vehicles in a facility (file photo)"),
    "zelda-ocarina-remake-interview": ("zelda-ocarina-remake-interview.md", "Technology", "November 2, 2026",
                                        "zelda-ocarina-remake.jpg", "A forest path (file photo)"),
    "canelo-reclaims-wbc-title-mbilli": ("canelo-reclaims-wbc-title-mbilli.md", "Sports", "November 1, 2026",
                                         "canelo-reclaims-wbc-title-mbilli.jpg", "Canelo Alvarez at a promotional appearance in 2017 (file photo)"),
    # New posts, November 1, 2026 (Trends batch)
    "haley-stevens-endorses-rogers": ("haley-stevens-endorses-rogers.md", "Politics", "November 1, 2026",
                                       "haley-stevens-endorses-rogers.jpg", "Haley Stevens in her official House portrait (file photo)"),
    "chris-murphy-stroke-hospitalized": ("chris-murphy-stroke-hospitalized.md", "Politics", "November 1, 2026",
                                          "chris-murphy-stroke-hospitalized.jpg", "Chris Murphy in his official Senate portrait (file photo)"),
    # New posts, November 2, 2026 (Trends batch)
    "learjet-60-palm-beach-crash": ("learjet-60-palm-beach-crash.md", "Politics", "November 2, 2026",
                                     "learjet-60-palm-beach-crash.jpg", "A Learjet 60 in flight (file photo)"),
    "florida-state-fires-mike-norvell": ("florida-state-fires-mike-norvell.md", "Sports", "November 2, 2026",
                                          "florida-state-fires-mike-norvell.jpg", "Mike Norvell on the Florida State sideline against SMU in September 2026 (file photo)"),
    "jack-campbell-neck-injury": ("jack-campbell-neck-injury.md", "Sports", "November 2, 2026",
                                   "jack-campbell-neck-injury.jpg", "Jack Campbell speaking at the 2023 NFL Combine (file photo)"),
    "dataline-10-6m-funding": ("dataline-10-6m-funding.md", "Technology", "October 31, 2026",
                                "dataline-10-6m-funding.jpg", "Rows of servers in a data center (file photo)"),
    # New post, November 2, 2026 (Trends batch)
    "arizona-floods-sedona-oak-creek": ("arizona-floods-sedona-oak-creek.md", "Politics", "November 2, 2026",
                                        "arizona-floods-sedona-oak-creek.jpg", "Oak Creek Canyon above Sedona, Arizona (file photo)"),
    # New posts, November 3, 2026 (Trends batch)
    "karl-bushby-28-year-walk-home": ("karl-bushby-28-year-walk-home.md", "Culture", "November 2, 2026",
                                       "karl-bushby-homecoming.jpg", "Karl Bushby in Hull in November 2026"),
    "olmesartan-blood-pressure-recall": ("olmesartan-blood-pressure-recall.md", "Health", "November 3, 2026",
                                          "olmesartan-blood-pressure-check.jpg", "A nurse checking a patient's blood pressure (file photo)"),
    # New post, November 3, 2026 (Trends + startup lane)
    "marvell-buys-lumentum-115b": ("marvell-buys-lumentum-115b.md", "Business", "November 3, 2026",
                                    "marvell-lumentum.jpg", "Spools of optical fiber cable (file photo)"),
    # New posts, November 3, 2026 (Trends + startup lane)
    "rachel-apa-nyc-marathon-death": ("rachel-apa-nyc-marathon-death.md", "Sports", "November 4, 2026",
                                       "rachel-apa-nyc-marathon.jpg", "Runners leaving Central Park after the New York City Marathon in 2024 (file photo)"),
    "larridin-series-a-30m": ("larridin-series-a-30m.md", "Business", "November 4, 2026",
                               "larridin-series-a-30m.jpg", "Rows of servers in a data center (file photo)"),
    "salesforce-acquires-cresta-voice-ai": ("salesforce-acquires-cresta-voice-ai.md", "Business", "November 4, 2026",
                                             "salesforce-acquires-cresta-voice-ai.jpg", "Salesforce Tower in San Francisco (file photo)"),
    # New post, November 4, 2026 (Trends batch)
    "microsoft-25-billion-bond-sale": ("microsoft-25-billion-bond-sale.md", "Business", "November 4, 2026",
                                        "microsoft-campus.jpg", "Microsoft campus in Redmond (file photo)"),
    "abdul-el-sayed-wins-michigan-senate": ("abdul-el-sayed-wins-michigan-senate.md", "Politics", "November 4, 2026",
                                             "abdul-el-sayed-wins-michigan-senate.jpg", "Abdul El-Sayed at a campaign meet-and-greet in Michigan in October 2025 (file photo)"),
    # New posts, November 5, 2026 (Trends batch + startup lane)
    "traversal-series-b-120m": ("traversal-series-b-120m.md", "Business", "November 5, 2026",
                                  "traversal-series-b-120m.jpg", "Server racks in a data center (file photo)"),
    "playstation-store-black-friday-2026": ("playstation-store-black-friday-2026.md", "Technology", "November 5, 2026",
                                               "playstation-store-black-friday-2026.jpg", "A PlayStation 5 console with a DualSense controller (file photo)"),
    # New post, November 5, 2026 (startup lane)
    "eloelo-series-c-80m": ("eloelo-series-c-80m.md", "Business", "November 5, 2026",
                            "eloelo-series-c-80m.jpg", "A woman watching her phone on a bus (file photo)"),
    # New posts, November 5, 2026 (Trends batch + startup lane)
    "outback-steakhouse-franchisee-bankruptcy": ("outback-steakhouse-franchisee-bankruptcy.md", "Business", "November 5, 2026",
                                                "outback-steakhouse-franchisee-bankruptcy.jpg", "An Outback Steakhouse restaurant (file photo)"),
    "pliant-series-c-80m": ("pliant-series-c-80m.md", "Business", "November 5, 2026",
                            "pliant-series-c-80m.jpg", "The Berlin skyline, where Pliant is headquartered (file photo)"),
    "titan-os-46m-funding": ("titan-os-46m-funding.md", "Business", "November 5, 2026",
                             "titan-os-46m-funding.jpg", "Smart TVs on display in a store (file photo)"),
    "bob-heinz-dies-79": ("bob-heinz-dies-79.md", "Sports", "November 5, 2026",
                          "bob-heinz-dies-79.jpg", "The Orange Bowl in Miami, the Dolphins' home stadium during their 1972 perfect season (file photo)"),
    # New posts, November 5, 2026 (Trends batch + startup lane)
    "powerball-847-million-new-jersey-winner": ("powerball-847-million-new-jersey-winner.md", "Culture", "November 5, 2026",
                                                "powerball-847-million-new-jersey-winner.jpg", "A billboard advertising Powerball and Mega Millions jackpots in Missouri (file photo)"),
    "agility-robotics-nasdaq-debut-aglt": ("agility-robotics-nasdaq-debut-aglt.md", "Business", "November 5, 2026",
                                           "agility-robotics-nasdaq-debut-aglt.jpg", "The Nasdaq Tower in Times Square in May 2026 (file photo)"),
    "bob-dylan-meets-pope-leo-vatican": ("bob-dylan-meets-pope-leo-vatican.md", "Culture", "November 5, 2026",
                                         "bob-dylan-meets-pope-leo-vatican.jpg", "Bob Dylan performing in November 1963 (file photo)"),
    # New posts, November 5, 2026 (Trends batch + startup lane)
    "russell-brand-convicted-rape-sexual-assault": ("russell-brand-convicted-rape-sexual-assault.md", "Culture", "November 5, 2026",
                                                    "russell-brand-convicted-rape-sexual-assault.jpg", "Russell Brand in 2014 (file photo)"),
    "zipline-1-5-billion-raise-walmart-300-sites": ("zipline-1-5-billion-raise-walmart-300-sites.md", "Business", "November 5, 2026",
                                                    "zipline-1-5-billion-raise-walmart-300-sites.jpg", "A Zipline drone launching from its catapult (file photo)"),
    "harbinger-240-million-series-d": ("harbinger-240-million-series-d.md", "Business", "November 5, 2026",
                                       "harbinger-240-million-series-d.jpg", "An all-electric delivery truck (file photo)"),
    # New posts, November 6, 2026 (Trends batch + startup lane)
    "nasdaq-nov5-selloff-correction": ("nasdaq-nov5-selloff-correction.md", "Business", "November 6, 2026",
                                       "nasdaq-nov5-selloff.jpg", "The Nasdaq MarketSite tower in Times Square, New York (file photo)"),
    "paraguay-president-resigns-ueno-bank-collapse": ("paraguay-president-resigns-ueno-bank-collapse.md", "Politics", "November 6, 2026",
                                       "paraguay-president-pena.jpg", "Santiago Peña, president of Paraguay (file photo)"),
    "artemis-ii-ionosphere-gps-study": ("artemis-ii-ionosphere-gps-study.md", "Science", "November 6, 2026",
                                       "artemis-ii-launch.jpg", "NASA's Space Launch System rocket lifts off carrying the Artemis II crew on April 1, 2026"),
    "sentra-150m-series-c": ("sentra-150m-series-c.md", "Business", "November 6, 2026",
                              "sentra-data-center.jpg", "A data center server room (file photo)"),
    # New posts, November 6, 2026 (Trends batch + startup lane)
    "ronaldo-retires-portugal": ("ronaldo-retires-portugal.md", "Sports", "November 6, 2026",
                                 "ronaldo-retires-portugal.jpg", "Cristiano Ronaldo in Portugal's No. 7 shirt during the 2026 World Cup (file photo)"),
    "shield-ai-echodyne-5-3-billion": ("shield-ai-echodyne-5-3-billion.md", "Business", "November 6, 2026",
                                       "shield-ai-vbat.jpg", "A Shield AI V-BAT drone in flight (file photo)"),
    "wonder-files-confidential-ipo": ("wonder-files-confidential-ipo.md", "Business", "November 6, 2026",
                                      "wonder-food-hall.jpg", "A Wonder food hall storefront in New York (file photo)"),
    # New posts, November 6, 2026 (Trends batch + startup lane)
    "irs-2027-tax-brackets-standard-deduction": ("irs-2027-tax-brackets-standard-deduction.md", "Business", "November 6, 2026",
                                      "irs-2027-tax-brackets.jpg", "Sign outside the Internal Revenue Service building in Washington, DC (file photo)"),
    "florida-floods-november-2026": ("florida-floods-november-2026.md", "Politics", "November 6, 2026",
                                      "florida-floods-november-2026.jpg", "A flooded street in Sebastian, Florida, on November 2, 2026"),
    "nooks-500m-general-catalyst-node": ("nooks-500m-general-catalyst-node.md", "Business", "November 6, 2026",
                                      "nooks-500m-node.jpg", "A sales agent wearing a telephone headset (file photo)"),
    # New posts, November 6, 2026 (Trends batch + startup lane)
    "jay-rockefeller-dies-89": ("jay-rockefeller-dies-89.md", "Politics", "November 6, 2026",
                                "jay-rockefeller-dies-89.jpg", "Jay Rockefeller in his official Senate portrait (file photo)"),
    "tesla-cybertruck-wind-down-2027": ("tesla-cybertruck-wind-down-2027.md", "Technology", "November 6, 2026",
                                         "tesla-cybertruck-wind-down-2027.jpg", "A Tesla Cybertruck Foundation Series (file photo)"),
    "kalepa-series-b-75m": ("kalepa-series-b-75m.md", "Business", "November 6, 2026",
                            "kalepa-series-b-75m.jpg", "The New York skyline at dusk, where Kalepa is headquartered (file photo)"),
    # New posts, November 7, 2026 (Trends batch + startup lane)
    "stephen-miller-chief-of-staff": ("stephen-miller-chief-of-staff.md", "Politics", "November 7, 2026",
                                      "stephen-miller-chief-of-staff.jpg", "Stephen Miller speaking at CPAC in February 2025 (file photo)"),
    "thomas-markle-arrested-fbi": ("thomas-markle-arrested-fbi.md", "Culture", "November 7, 2026",
                                   "thomas-markle-arrested.jpg", "Thomas Wayne Markle in 1962 (file photo)"),
    "michael-sanft-dies": ("michael-sanft-dies.md", "Culture", "November 7, 2026",
                           "michael-sanft-dies.jpg", "The federal courthouse in Las Vegas (file photo)"),
    "physicl-10m-seed-studio": ("physicl-10m-seed-studio.md", "Business", "November 7, 2026",
                                "physicl-10m-seed.jpg", "A robot arm at work in a factory (file photo)"),
    # New post, November 7, 2026 (12:13 run, startup lane)
    "google-crusoe-wyoming-data-center": ("google-crusoe-wyoming-data-center.md", "Technology", "November 7, 2026",
                                          "google-crusoe-wyoming-data-center.jpg", "The power substation at Google's data center in The Dalles, Oregon (file photo)"),
    # New post, November 7, 2026 (18:13 run, trends)
    "scott-laux-blue-angels-removal": ("scott-laux-blue-angels-removal.md", "Politics", "November 7, 2026",
                                       "scott-laux-blue-angels-removal.jpg", "A Blue Angels F/A-18 in flight (file photo)"),
    # New posts, November 7, 2026 (00:13 run, trends + startup lane)
    "october-jobs-report-165000-jobs": ("october-jobs-report-165000-jobs.md", "Business", "November 7, 2026",
                                        "october-jobs-report-165000-jobs.jpg", "The Frances Perkins Building, home of the US Department of Labor in Washington, DC (file photo)"),
    "sony-mdr-3r-walkman-headphones": ("sony-mdr-3r-walkman-headphones.md", "Technology", "November 7, 2026",
                                       "sony-mdr-3r-walkman-headphones.jpg", "The original 1979 Sony Walkman TPS-L2 (file photo)"),
    "synctera-24-5m-funding": ("synctera-24-5m-funding.md", "Business", "November 7, 2026",
                                "synctera-24-5m-funding.jpg", "A U.S. Bank branch in Port Townsend, Washington (file photo)"),
    # New posts, November 8, 2026 (06:13 run, trends)
    "trump-offers-dana-white-press-secretary": ("trump-offers-dana-white-press-secretary.md", "Politics", "November 7, 2026",
                                                "dana-white-press-secretary.jpg", "Dana White, president of the UFC (file photo)"),
    "berkshire-q3-2026-earnings-buybacks": ("berkshire-q3-2026-earnings-buybacks.md", "Business", "November 7, 2026",
                                            "berkshire-q3-2026-earnings.jpg", "Kiewit Plaza in Omaha, Berkshire Hathaway's headquarters (file photo)"),
    # New post, November 8, 2026 (12:13 run, trends)
    "krakow-main-market-square-shooting": ("krakow-main-market-square-shooting.md", "Politics", "November 7, 2026",
                                          "krakow-main-market-square.jpg", "The Cloth Hall and Main Market Square in Krakow, Poland (file photo)"),
    # New post, November 8, 2026 (18:13 run, news)
    "trump-orders-doj-investigate-democrats": ("trump-orders-doj-investigate-democrats.md", "Politics", "November 8, 2026",
                                               "trump-doj-investigation-democrats.jpg", "Official 2025 portrait of President Donald Trump (file photo)"),
    # New posts, November 8, 2026 (00:13 run, trends + startup lane)
    "wake-county-cyclists-crash": ("wake-county-cyclists-crash.md", "Politics", "November 8, 2026",
                                   "wake-county-cyclists-crash.jpg", "Cyclists on a group ride (file photo)"),
    "axon-skydio-1-2-billion": ("axon-skydio-1-2-billion.md", "Business", "November 8, 2026",
                                "axon-skydio-1-2-billion.jpg", "A Skydio X10 drone in flight (file photo)"),
    "royal-caribbean-pianist-rescued-pacific": ("royal-caribbean-pianist-rescued-pacific.md", "Culture", "November 8, 2026",
                                               "royal-caribbean-pianist-rescued-pacific.jpg", "Royal Caribbean's Ovation of the Seas in Sydney in 2025 (file photo)"),
    "fda-cinnamon-lead-alert-21-products": ("fda-cinnamon-lead-alert-21-products.md", "Health", "November 8, 2026",
                                            "fda-cinnamon-lead-alert-21-products.jpg", "Ground cinnamon powder with cinnamon sticks (file photo)"),
    # New posts, November 9, 2026 (06:13 run, trends)
    "microsoft-workers-open-letter-ai-push": ("microsoft-workers-open-letter-ai-push.md", "Technology", "November 9, 2026",
                                             "microsoft-building92.jpg", "Microsoft headquarters Building 92 in Redmond, Washington (file photo)"),
    "new-zealand-election-no-clear-winner": ("new-zealand-election-no-clear-winner.md", "Politics", "November 9, 2026",
                                            "beehive-wellington.jpg", "The Beehive, the Executive Wing of New Zealand's Parliament in Wellington (file photo)"),
    # New posts, November 9, 2026 (12:13 run, trends)
    "nvidia-board-probe-jensen-huang": ("nvidia-board-probe-jensen-huang.md", "Business", "November 9, 2026",
                                        "nvidia-huang-board-probe.jpg", "Jensen Huang, founder and CEO of Nvidia, during a fireside chat at Stanford University in April 2026 (file photo)"),
    "delhi-aqi-severe-after-diwali": ("delhi-aqi-severe-after-diwali.md", "Environment", "November 9, 2026",
                                      "delhi-aqi-severe-november-9.jpg", "Smog hangs over the Delhi skyline at Connaught Place in a file photo"),
    # New posts, November 9, 2026 (18:13 run, trends)
    "trump-60-minutes-interview": ("trump-60-minutes-interview.md", "Politics", "November 9, 2026",
                                   "trump-60-minutes-interview.jpg", "President Donald Trump at the White House in January 2026 (file photo)"),
    "mike-tirico-misses-sunday-night-football": ("mike-tirico-misses-sunday-night-football.md", "Sports", "November 9, 2026",
                                                "mike-tirico-misses-snf.jpg", "Mike Tirico at a broadcast desk in 2017 (file photo)"),
    # New posts, November 9, 2026 (00:13 run, trends + startup lane)
    "james-gunn-peter-safran-dc-studios-exit": ("james-gunn-peter-safran-dc-studios-exit.md", "Entertainment", "November 9, 2026",
                                                "james-gunn-dc-studios-exit.jpg", "James Gunn speaking at San Diego Comic-Con in 2016 (file photo)"),
    "jaguars-trade-jessie-bates": ("jaguars-trade-jessie-bates.md", "Sports", "November 9, 2026",
                                   "jaguars-trade-jessie-bates.jpg", "Jessie Bates III in 2023 (file photo)"),
    "nominal-240m-series-c": ("nominal-240m-series-c.md", "Business", "November 9, 2026",
                              "nominal-240m-series-c.jpg", "A space shuttle main engine test firing (file photo)"),
    "onodrim-300m-series-a": ("onodrim-300m-series-a.md", "Business", "November 9, 2026",
                              "onodrim-300m-series-a.jpg", "A Rheinmetall defense factory in Oerlikon, Switzerland (file photo)"),
    "rochelle-fleming-dies-72": ("rochelle-fleming-dies-72.md", "Culture", "November 9, 2026",
                                 "rochelle-fleming-dies-72.jpg", "First Choice performing at a Salsoul reunion show in 2014 (file photo)"),
    # New posts, November 10, 2026 (06:13 run, trends + startup lane)
    "russell-brand-sentenced-10-years": ("russell-brand-sentenced-10-years.md", "Entertainment", "November 9, 2026",
                                         "russell-brand-sentenced-10-years.jpg", "Russell Brand performing on stage in 2008 (file photo)"),
    "massie-impeachment-hegseth-vote": ("massie-impeachment-hegseth-vote.md", "Politics", "November 9, 2026",
                                        "massie-impeachment-hegseth-vote.jpg", "Pete Hegseth, Secretary of Defense, in his official portrait (file photo)"),
    "eagles-trade-jordan-davis-jaguars": ("eagles-trade-jordan-davis-jaguars.md", "Sports", "November 9, 2026",
                                          "eagles-trade-jordan-davis-jaguars.jpg", "Jordan Davis in an Eagles uniform during a game against Washington (file photo)"),
    "claude-fable-5-2-mythos-5-2": ("claude-fable-5-2-mythos-5-2.md", "Technology", "November 9, 2026",
                                    "claude-fable-5-2-mythos-5-2.jpg", "The Claude chatbot interface (file photo)"),
    "project-omega-80m-series-a": ("project-omega-80m-series-a.md", "Business", "November 9, 2026",
                                    "project-omega-80m-series-a.jpg", "A spent fuel pool at the San Onofre Nuclear Generating Station (file photo)"),
    "spines-64m-series-a1": ("spines-64m-series-a1.md", "Business", "November 9, 2026",
                             "spines-64m-series-a1.jpg", "Books on a shelf (file photo)"),
    # New posts, November 10, 2026 (12:13 run, trends + startup lane)
    "gta-6-preload-begins-november-10": ("gta-6-preload-begins-november-10.md", "Technology", "November 10, 2026",
                                         "gta-6-preload-begins-november-10.jpg", "A PlayStation 5 console and DualSense controller (file photo)"),
    "bills-beat-vikings-23-6-wentz-benched": ("bills-beat-vikings-23-6-wentz-benched.md", "Sports", "November 9, 2026",
                                              "bills-beat-vikings-23-6-wentz-benched.jpg", "Carson Wentz on the sideline in 2019 (file photo)"),
    "coframe-25m-series-a": ("coframe-25m-series-a.md", "Business", "November 9, 2026",
                             "coframe-25m-series-a.jpg", "An online store displayed on a laptop screen (file photo)"),
    "geniosai-19-1m-funding-factset": ("geniosai-19-1m-funding-factset.md", "Business", "November 9, 2026",
                                      "geniosai-19-1m-funding-factset.jpg", "The New York Stock Exchange trading floor (file photo)"),
    # New posts, November 10, 2026 (18:13 run, trends + startup lane)
    "fda-glp1-naion-warning": ("fda-glp1-naion-warning.md", "Health", "November 9, 2026",
                               "fda-glp1-naion-warning.jpg", "An Ozempic injection pen (file photo)"),
    "primordial-18m-series-a": ("primordial-18m-series-a.md", "Business", "November 10, 2026",
                                "primordial-18m-series-a.jpg", "An M1A2 Abrams tank fires during a live fire exercise in Kuwait in 2023 (file photo)"),
    "jimenez-ice-lawsuit-25m": ("jimenez-ice-lawsuit-25m.md", "Politics", "November 9, 2026",
                                "jimenez-ice-lawsuit-25m.jpg", "Federal agents during an immigration enforcement operation (file photo)"),
    # New posts, November 10, 2026 (00:13 run, trends + startup lane)
    "ring-drone-cam-rover-cam": ("ring-drone-cam-rover-cam.md", "Technology", "November 10, 2026",
                                 "ring-drone-cam-rover-cam.jpg", "A Ring video doorbell mounted beside a front door (file photo)"),
    "mercor-750m-series-d": ("mercor-750m-series-d.md", "Business", "November 10, 2026",
                             "mercor-750m-series-d.jpg", "Downtown San Francisco, where Mercor is headquartered (file photo)"),
    "bob-boone-dies-78": ("bob-boone-dies-78.md", "Sports", "November 10, 2026",
                          "bob-boone-dies-78.jpg", "Bob Boone signing autographs at a Phillies event in 2023 (file photo)"),
    "newborn-vitamin-k-bleeding-risk": ("newborn-vitamin-k-bleeding-risk.md", "Health", "November 5, 2026",
                                        "newborn-vitamin-k-bleeding-risk.jpg", "A newborn baby yawning (file photo)"),
    # New posts, November 10, 2026 (06:13 run, trends + startup lane)
    "kirk-cousins-vikings-return": ("kirk-cousins-vikings-return.md", "Sports", "November 10, 2026",
                                    "kirk-cousins-vikings-return.jpg", "Kirk Cousins in a Minnesota Vikings uniform in 2022 (file photo)"),
    "jim-jordan-house-gop-minority-leader": ("jim-jordan-house-gop-minority-leader.md", "Politics", "November 10, 2026",
                                             "jim-jordan-house-gop-leader.jpg", "Rep. Jim Jordan speaking at a podium (file photo)"),
    "david-walliams-bbc-little-britain": ("david-walliams-bbc-little-britain.md", "Entertainment", "November 10, 2026",
                                          "david-walliams-bbc-little-britain.jpg", "David Walliams in 2012 (file photo)"),
    "house-blocks-hegseth-impeachment-211-204": ("house-blocks-hegseth-impeachment-211-204.md", "Politics", "November 10, 2026",
                                                 "hegseth-impeachment-vote-211-204.jpg", "Secretary of Defense Pete Hegseth in his official portrait"),
    "chiefs-trade-josh-downs": ("chiefs-trade-josh-downs.md", "Sports", "November 10, 2026",
                                "chiefs-trade-josh-downs.jpg", "Arrowhead Stadium, home of the Kansas City Chiefs (file photo)"),
    "keenan-allen-49ers-trade": ("keenan-allen-49ers-trade.md", "Sports", "November 10, 2026",
                                 "keenan-allen-49ers-trade.jpg", "Keenan Allen with the Los Angeles Chargers in 2021 (file photo)"),
    "path-robotics-300m-series-e": ("path-robotics-300m-series-e.md", "Business", "November 10, 2026",
                                    "path-robotics-300m-series-e.jpg", "A robotic welding cell in a factory (file photo)"),
    "gta-6-30fps-ps5-pro": ("gta-6-30fps-ps5-pro.md", "Technology", "November 10, 2026",
                            "gta-6-30fps-ps5-pro.jpg", "PlayStation consoles including the PlayStation 5 (file photo)"),
}

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


def inline(text: str) -> str:
    """Convert one markdown line to inline HTML (links + bold), safely escaped."""
    links = {}

    def stash(m):
        key = f"\x00LINK{len(links)}\x00"
        links[key] = f'<a href="{m.group(2)}">{m.group(1)}</a>'
        return key

    text = LINK_RE.sub(stash, text)
    text = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    text = BOLD_RE.sub(r"<strong>\1</strong>", text)
    for key, html in links.items():
        text = text.replace(key, html)
    return text


def plain(text: str) -> str:
    """Strip markdown for meta descriptions."""
    text = LINK_RE.sub(r"\1", text)
    text = text.replace("**", "")
    return text


def body_html(md: str) -> tuple[str, str]:
    """Return (body HTML, first paragraph plain text)."""
    lines = md.splitlines()
    title = ""
    out: list[str] = []
    ul: list[str] = []
    first_para = ""

    def flush_ul():
        nonlocal ul
        if ul:
            out.append("<ul>")
            out.extend(ul)
            out.append("</ul>")
            ul = []

    for raw in lines:
        line = raw.strip()
        if not line:
            flush_ul()
            continue
        if line.startswith("# "):
            title = line[2:].strip()
            continue
        if line.startswith("## "):
            flush_ul()
            out.append(f"<h2>{inline(line[3:].strip())}</h2>")
            continue
        if line.startswith("- "):
            ul.append(f"<li>{inline(line[2:].strip())}</li>")
            continue
        flush_ul()
        out.append(f"<p>{inline(line)}</p>")
        if not first_para:
            first_para = plain(line)
    flush_ul()
    return "\n".join(out), title, first_para


def main() -> None:
    template = (POSTS / "anthropic-ipo.html").read_text()
    head, rest = template.split('<main class="page article">', 1)
    _, tail = rest.split('<p class="article-back">', 1)
    tail = '<p class="article-back">' + tail

    only = sys.argv[1:] or list(PAGES)
    for slug in only:
        draft, category, date, image, alt = PAGES[slug]
        md = (DRAFTS / draft).read_text()
        body, title, first_para = body_html(md)
        assert title, f"{slug}: no title"
        assert "<ul>" in body, f"{slug}: no bullet list in body"
        assert "- **" not in body and "## " not in body, f"{slug}: markdown leftover"
        desc = first_para[:155]
        if len(first_para) > 155:
            desc = desc.rsplit(" ", 1)[0]
        desc = desc.replace('"', "")
        page = (
            head
            + '<main class="page article">\n'
            + f'    <p class="eyebrow">{category} &middot; {date}</p>\n'
            + f"    <h1>{title}</h1>\n"
            + f'    <p class="article-meta">By Jayesh Marathe &middot; {date} &middot; 7 min read</p>\n'
            + f'    <img class="article-img" src="../images/{image}" alt="{alt}">\n'
            + '    <div class="article-body">\n'
            + body
            + "\n    </div>\n    "
            + tail
        )
        # Swap the template title/description for this post's own
        page = re.sub(r"<title>.*?</title>",
                      f"<title>{title} \u2014 Next Trend Wire</title>", page, count=1)
        page = re.sub(r'<meta name="description" content="[^"]*">',
                      f'<meta name="description" content="{desc}">', page, count=1)
        # Swap the template canonical for this post's own clean URL
        page = re.sub(r'<link rel="canonical" href="[^"]*">',
                      f'<link rel="canonical" href="https://next-trend-wire.vercel.app/posts/{slug}">', page, count=1)
        # This post's own NewsArticle JSON-LD (strip the template's copy first)
        page = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', "",
                      page, count=1, flags=re.DOTALL)
        iso_date = datetime.strptime(date, "%B %d, %Y").strftime("%Y-%m-%d")
        ld = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": title,
            "image": f"https://next-trend-wire.vercel.app/images/{image}",
            "datePublished": iso_date,
            "dateModified": iso_date,
            "author": {"@type": "Person", "name": "Jayesh Marathe"},
            "publisher": {"@type": "Organization", "name": "Next Trend Wire"},
            "mainEntityOfPage": f"https://next-trend-wire.vercel.app/posts/{slug}",
        }
        ld_script = ('<script type="application/ld+json">\n'
                     + json.dumps(ld, ensure_ascii=False, indent=2) + "\n</script>\n")
        page = page.replace("</head>", ld_script + "</head>", 1)
        assert "G-LNQNTTBR2P" in page, f"{slug}: GA tag missing"
        assert "z4wdrb84h6" in page, f"{slug}: Clarity tag missing"
        assert "Jayesh Marathe" in page, f"{slug}: byline missing"
        assert "application/ld+json" in page, f"{slug}: JSON-LD missing"
        _canon = re.search(r'<link rel="canonical" href="([^"]+)">', page)
        assert _canon and _canon.group(1) == f"https://next-trend-wire.vercel.app/posts/{slug}", f"{slug}: canonical missing or wrong"
        assert "\u2014" in page.split("<title>")[1].split("</title>")[0], f"{slug}: title not set"
        (POSTS / f"{slug}.html").write_text(page)
        print(f"built {slug}.html ({len(body.splitlines())} body lines)")


if __name__ == "__main__":
    main()
