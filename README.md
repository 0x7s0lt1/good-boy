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
  url                           URL to Crawl

Options:
  -V, --version                 output the version number
  -q, --query <query>           Search query string
  -e, --email                   Search for emails
  -regx, --regex <regex>        Regex to search
  -img, --image <image>         Path of a image search pattern
  -mysql, --use-mysql           Use MySQL instead of memory to save temporary data.
  -mongo, --use-mongo           Use MongoDB instead of memory to save temporary data.
  -o, --output <oputput path>   Output Path (default: "./")
  -t, --timeout <milliseconds>  Maximum /page crawling time
  -er, --error-report           Prints error to the console!
  -h, --help                    display help for command
  
```

# Example
### Commands
Looking for email addresses
```
ts-node index.ts https://tradensea.com -e
```
Looking for the text "spod bot", and images that look similar to "Eng_Flag.png" at tradensea.com.
```
ts-node index.ts https://tradensea.com -q spot bot -img C:\Users\xy\Downloads\Eng_Flag.png
```
