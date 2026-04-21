# Day of the year with peak cherry tree blossom in Kyoto, Japan - Data package

This data package contains the data that powers the chart ["Day of the year with peak cherry tree blossom in Kyoto, Japan"](https://ourworldindata.org/grapher/date-of-the-peak-cherry-tree-blossom-in-kyoto?v=1&csvType=full&useColumnShortNames=false) on the Our World in Data website.

## CSV Structure

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For most countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

The remaining columns are the data columns, each of which is a time series. If the CSV data is downloaded using the "full data" option, then each column corresponds to one time series below. If the CSV data is downloaded using the "only selected data visible in the chart" option then the data columns are transformed depending on the chart type and thus the association with the time series might not be as straightforward.


## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc.. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc..

## About the data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

### How we process data at Our World In Data
All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.
[Read about our data pipeline](https://docs.owid.io/projects/etl/)

## Detailed information about each time series


## Day of the year with peak cherry blossom
The day of the year with the peak cherry blossom of the Prunus jamasakura species of cherry tree in Kyoto, Japan.
Last updated: April 16, 2026  
Next update: April 2027  
Date range: 812–2026  
Unit: day of the year  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
Yasuyuki Aono (2026); Yasuyuki Aono (2021) – with minor processing by Our World in Data

#### Full citation
Yasuyuki Aono (2026); Yasuyuki Aono (2021) – with minor processing by Our World in Data. “Day of the year with peak cherry blossom” [dataset]. Yasuyuki Aono, “Cherry Blossom Full Bloom Dates in Kyoto, Japan” [original data].
Source: Yasuyuki Aono (2026), Yasuyuki Aono (2021) – with minor processing by Our World In Data

### Source

#### Yasuyuki Aono – Cherry Blossom Full Bloom Dates in Kyoto, Japan
Retrieved on: 2026-04-16  
Retrieved from: https://www.ncei.noaa.gov/access/paleo-search/study/26430  


## Thirty-year average
A thirty year moving average of the day of the year with peak cherry blossom (Prunus jamasakura species). Only calculated for 30-year periods with at least ten years of data.
Last updated: April 16, 2026  
Next update: April 2027  
Date range: 913–2026  
Unit: day of the year  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
Yasuyuki Aono (2026); Yasuyuki Aono (2021) – with major processing by Our World in Data

#### Full citation
Yasuyuki Aono (2026); Yasuyuki Aono (2021) – with major processing by Our World in Data. “Thirty-year average” [dataset]. Yasuyuki Aono, “Cherry Blossom Full Bloom Dates in Kyoto, Japan” [original data].
Source: Yasuyuki Aono (2026), Yasuyuki Aono (2021) – with major processing by Our World In Data

### Source

#### Yasuyuki Aono – Cherry Blossom Full Bloom Dates in Kyoto, Japan
Retrieved on: 2026-04-16  
Retrieved from: https://www.ncei.noaa.gov/access/paleo-search/study/26430  

#### Notes on our processing step for this indicator
- The 30-year moving average is calculated by taking the last 30 years (including the current year) and averaging over the day of the year with peak cherry blossom. The average is only calculated for 30-year periods with at least ten years of data.
- This means the average for 2026 includes data from 1997 to 2026, and is only calculated if at least ten of those years have data on the peak cherry blossom.


    