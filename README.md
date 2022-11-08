<div align="center">
<img src="https://media.tenor.com/IUOroMLMNzgAAAAM/costume-funny.gif">
<h1>Good Boooy</h1>
<p>Web Crawler<p>
</div>

# Usage
```
Usage: Good-Boy Crawler [options] <url>

CLI to search text or image in a given website!

Arguments:
  url                          URL to Crawl

Options:
  -V, --version                output the version number
  -q, --query <query>          Search query
  -img, --image <image>        Path of a image search pattern
  -o, --output <oputput path>  Output Path (default: "./")
  -e, --error-report           Prints error to the console!
  -h, --help                   display help for command
  
```
# Example
### Command
Looking for the text "spod bot", and images that look similar to "Eng_Flag.png" at tradensea.com.
```
ts-node index.ts https://tradensea.com -q spot bot -img C:\Users\xy\Downloads\Eng_Flag.png
```
### Result
  Generated file : <b>tradensea.com1667944355436.txt<b>
```
TEXT MATCH: 1 | URL: https://tradensea.com/author/NiarzAdmin/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/biztonsag/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/edukacio/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/felhasznaloi_felulet/  
TEXT MATCH: 1 | URL: https://tradensea.com/2022/08/29/a-fiokom-biztonsag/#respond  
TEXT MATCH: 3 | URL: https://tradensea.com/temak/hirek/  
SIMILAR IMAGE: 0% 
   SRC: https://tradensea.com/wp-content/uploads/2022/10/Eng_Flag.png  
   URL: https://tradensea.com/  
SIMILAR IMAGE: 0% 
   SRC: https://tradensea.com/wp-content/uploads/2022/10/Eng_Flag.png  
   URL: https://tradensea.com/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/jogi_dokumentumok/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/promociok/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/tradensea/  
TEXT MATCH: 1 | URL: https://tradensea.com/kezdolap/  
TEXT MATCH: 12 | URL: https://tradensea.com/2022/10/24/ime-a-spot-botok-amik-lehetove-teszik-az-automata-kereskedest/#respond  
TEXT MATCH: 1 | URL: https://tradensea.com/2022/10/24/kriptovaluta-kereskedes-kezdoknek/#respond  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/regisztracio/  
TEXT MATCH: 1 | URL: https://tradensea.com/temak/hirek/page/2/  
TEXT MATCH: 1 | URL: https://tradensea.com/2022/06/02/igy-mukodik-egy-kereskedo-robot/#respond  
```
