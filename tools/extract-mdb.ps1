<#
.SYNOPSIS
    Extracts 和合本 (Chinese Union Version) Bible text (simplified + traditional) and the
    66-book metadata out of the original 《语音投影圣经》5.20-SP2 无声版 data file
    (bibleNosound.dat - a Microsoft Access / Jet 4 MDB) into:

      data/bible-simplified.json    [[bookId, chapter, verse, "text"], ...]
      data/bible-traditional.json    same shape, traditional text (BibleF)
      src/shared/books.js            CommonJS module: CATEGORIES + BOOKS
      tools/extraction-report.txt    validation report (row counts, anomalies, SHA-256)

.DESCRIPTION
    The original app stores the text in two Jet tables that share the same schema:
      Bible    (ID, VolumeSN, ChapterSN, VerseSN, Status, strjw, soundname, ...)
      BibleF   (same columns)   -> 和合本 traditional text
    and the book index in:
      bibleid  (SN, KindSN, ChapterNumber, VerseNumber, FirstSN, NewOrOld, PY, ShortName, FullName)
      bibleidF (same columns)   -> traditional book names

    IMPORTANT: only the 32-bit Microsoft Jet 4.0 OLEDB provider is installed on modern
    64-bit Windows, so this script MUST be executed by 32-bit PowerShell:

      C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\extract-mdb.ps1

    If you save the script yourself, save it as UTF-8 *with BOM* (or UTF-16LE) so the
    Chinese default path below survives PowerShell 5.1's decoder.

.EXAMPLE
    C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\extract-mdb.ps1
#>
[CmdletBinding()]
param(
    # Path to the original app's Access data file.
    [string]$DataFile = 'C:\语音投影圣经无声版\bibleNosound.dat',
    # Jet database password of bibleNosound.dat.
    [string]$Password = 'pasitoldata',
    # Where to write bible-simplified.json / bible-traditional.json.
    [string]$OutDir,
    # Where to write books.js.
    [string]$SharedDir,
    # Where to write the validation report.
    [string]$ReportFile
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------------------
# Resolve paths (default to the project layout: <root>/tools/extract-mdb.ps1)
# --------------------------------------------------------------------------------------
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir)    { $OutDir    = Join-Path $ProjectRoot 'data' }
if (-not $SharedDir) { $SharedDir = Join-Path $ProjectRoot 'src\shared' }
if (-not $ReportFile) { $ReportFile = Join-Path $ProjectRoot 'tools\extraction-report.txt' }

if (-not (Test-Path -LiteralPath $DataFile)) {
    throw "Data file not found: $DataFile  (pass -DataFile '<path to bibleNosound.dat>')"
}
foreach ($d in @($OutDir, $SharedDir, (Split-Path -Parent $ReportFile))) {
    if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
function ConvertTo-JsonString {
    param([string]$Value)
    if ($null -eq $Value) { return '""' }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $Value.ToCharArray()) {
        $code = [int]$ch
        if ($ch -eq '"') { [void]$sb.Append('\"') }
        elseif ($ch -eq '\') { [void]$sb.Append('\\') }
        elseif ($code -lt 32) {
            if ($code -eq 8) { [void]$sb.Append('\b') }
            elseif ($code -eq 9) { [void]$sb.Append('\t') }
            elseif ($code -eq 10) { [void]$sb.Append('\n') }
            elseif ($code -eq 12) { [void]$sb.Append('\f') }
            elseif ($code -eq 13) { [void]$sb.Append('\r') }
            else { [void]$sb.AppendFormat('\u{0:x4}', $code) }
        }
        else { [void]$sb.Append($ch) }
    }
    return '"' + $sb.ToString() + '"'
}

function ConvertTo-JsString {
    param([string]$Value)
    if ($null -eq $Value) { return '""' }
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $Value.ToCharArray()) {
        $code = [int]$ch
        if ($ch -eq '"') { [void]$sb.Append('\"') }
        elseif ($ch -eq '\') { [void]$sb.Append('\\') }
        elseif ($code -lt 32) {
            if ($code -eq 8) { [void]$sb.Append('\b') }
            elseif ($code -eq 9) { [void]$sb.Append('\t') }
            elseif ($code -eq 10) { [void]$sb.Append('\n') }
            elseif ($code -eq 12) { [void]$sb.Append('\f') }
            elseif ($code -eq 13) { [void]$sb.Append('\r') }
            else { [void]$sb.AppendFormat('\u{0:x4}', $code) }
        }
        else { [void]$sb.Append($ch) }
    }
    return '"' + $sb.ToString() + '"'
}

function Read-VerseRows {
    # Returns rows ordered by (VolumeSN, ChapterSN, VerseSN).
    param($Conn, [string]$Table)
    $cmd = $Conn.CreateCommand()
    $cmd.CommandText = "SELECT VolumeSN, ChapterSN, VerseSN, strjw FROM [$Table] ORDER BY VolumeSN, ChapterSN, VerseSN"
    $da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    [void]$da.Fill($dt)
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($row in $dt.Rows) {
        $t = $row['strjw']
        # TrimEnd(): the source Memo column carries trailing CR/LF on some rows
        # (e.g. Romans 7:1). Left in place they render as a blank line in
        # projection mode, so strip trailing whitespace at the source.
        if ($t -is [System.DBNull]) { $t = $null } else { $t = ([string]$t).TrimEnd() }
        $list.Add([pscustomobject]@{
            Book   = [int]$row['VolumeSN']
            Chapter = [int]$row['ChapterSN']
            Verse   = [int]$row['VerseSN']
            Text    = $t
        })
    }
    return $list
}

function Read-BookRows {
    param($Conn, [string]$Table)
    $cmd = $Conn.CreateCommand()
    $cmd.CommandText = "SELECT SN, KindSN, ChapterNumber, VerseNumber, FirstSN, NewOrOld, PY, ShortName, FullName FROM [$Table] ORDER BY SN"
    $da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    [void]$da.Fill($dt)
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($row in $dt.Rows) {
        $list.Add([pscustomobject]@{
            SN            = [int]$row['SN']
            KindSN        = [int]$row['KindSN']
            ChapterNumber = [int]$row['ChapterNumber']
            VerseNumber   = [int]$row['VerseNumber']
            FirstSN       = [int]$row['FirstSN']
            NewOrOld      = [bool]$row['NewOrOld']
            PY            = [string]$row['PY']
            ShortName     = [string]$row['ShortName']
            FullName      = [string]$row['FullName']
        })
    }
    return $list
}

function Get-Sha256 {
    param([string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $fs = [System.IO.File]::OpenRead($Path)
    try { $bytes = $sha.ComputeHash($fs) } finally { $fs.Dispose(); $sha.Dispose() }
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

# --------------------------------------------------------------------------------------
# Connect
# --------------------------------------------------------------------------------------
$connStr = 'Provider=Microsoft.Jet.OLEDB.4.0;Persist Security Info=False;Data Source=' + $DataFile + ';Jet OLEDB:DataBase password=' + $Password
# Hash the source BEFORE opening the provider: the Jet OLEDB connection pool keeps the
# .dat file locked for a while after Close(), which would break a later File.OpenRead.
$SourceSha256 = Get-Sha256 $DataFile
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
try { $conn.Open() } catch { throw "Could not open the Jet database '$DataFile'. $($_.Exception.Message)`n(If you see 'Provider not found', run this script with 32-bit PowerShell: C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe)" }

Write-Host "Connected: $DataFile"

$books   = Read-BookRows  $conn 'bibleid'
$booksF  = Read-BookRows  $conn 'bibleidF'
$verses  = Read-VerseRows $conn 'Bible'
$versesF = Read-VerseRows $conn 'BibleF'
$conn.Close()

$report = New-Object System.Collections.Generic.List[string]
function Add-Report { param([string]$Line) $report.Add($Line) }

Add-Report ('Extraction report - generated ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add-Report ('Source file : ' + $DataFile)
Add-Report ('Source SHA256: ' + $SourceSha256)
Add-Report ''
Add-Report ('Bible rows   : ' + $verses.Count)
Add-Report ('BibleF rows  : ' + $versesF.Count)
Add-Report ('bibleid rows : ' + $books.Count)
Add-Report ('bibleidF rows: ' + $booksF.Count)
Add-Report ''

# --------------------------------------------------------------------------------------
# Validate: same key sets between simplified and traditional
# --------------------------------------------------------------------------------------
$anomalies = New-Object System.Collections.Generic.List[string]
$keyS = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($v in $verses)  { [void]$keyS.Add(($v.Book.ToString() + ':' + $v.Chapter.ToString() + ':' + $v.Verse.ToString())) }
$keyF = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($v in $versesF) { [void]$keyF.Add(($v.Book.ToString() + ':' + $v.Chapter.ToString() + ':' + $v.Verse.ToString())) }

$onlyS = @($keyS | Where-Object { -not $keyF.Contains($_) })
$onlyF = @($keyF | Where-Object { -not $keyS.Contains($_) })
if ($onlyS.Count -gt 0) { $anomalies.Add('keys only in simplified (' + $onlyS.Count + '): ' + (($onlyS | Select-Object -First 20) -join ', ')) }
if ($onlyF.Count -gt 0) { $anomalies.Add('keys only in traditional (' + $onlyF.Count + '): ' + (($onlyF | Select-Object -First 20) -join ', ')) }
if ($verses.Count -ne $versesF.Count) { $anomalies.Add("row count differs: simplified=$($verses.Count) traditional=$($versesF.Count)") }

# duplicates / empty / short text / range checks on simplified
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$empty = 0; $short = 0; $nulls = 0; $dups = 0
$bookMeta = @{}
foreach ($b in $books) { $bookMeta[$b.SN] = $b }
foreach ($v in $verses) {
    $k = "$($v.Book):$($v.Chapter):$($v.Verse)"
    if (-not $seen.Add($k)) { $dups++; $anomalies.Add("duplicate key (simplified): $k") }
    if ($null -eq $v.Text) { $nulls++; $anomalies.Add("NULL text: $k") }
    else {
        $t = $v.Text.Trim()
        if ($t.Length -eq 0) { $empty++; $anomalies.Add("empty text: $k") }
        elseif ($t.Length -lt 3) { $short++; $anomalies.Add("short text ($($t.Length) chars): $k = $t") }
    }
    if ($bookMeta.ContainsKey($v.Book)) {
        if ($v.Chapter -lt 1 -or $v.Chapter -gt $bookMeta[$v.Book].ChapterNumber) {
            $anomalies.Add("chapter out of range: $k (book has $($bookMeta[$v.Book].ChapterNumber) chapters)")
        }
    } else {
        $anomalies.Add("verse references unknown book id: $k")
    }
}
foreach ($v in $versesF) {
    if ($null -eq $v.Text -or $v.Text.Trim().Length -eq 0) { $anomalies.Add("empty/NULL traditional text: $($v.Book):$($v.Chapter):$($v.Verse)") }
}

# verse-number continuity per chapter (missing verse numbers)
$chapters = @{}
foreach ($v in $verses) {
    $ck = "$($v.Book):$($v.Chapter)"
    if (-not $chapters.ContainsKey($ck)) { $chapters[$ck] = New-Object System.Collections.Generic.List[int] }
    $chapters[$ck].Add($v.Verse)
}
$gapCount = 0
foreach ($ck in ($chapters.Keys | Sort-Object)) {
    $list = $chapters[$ck]
    $sorted = @($list | Sort-Object)
    $expected = 1
    foreach ($n in $sorted) {
        if ($n -ne $expected) {
            $gapCount++
            $anomalies.Add("missing verse number(s) in chapter $ck : expected $expected, found $n")
            $expected = $n
        }
        $expected++
    }
}

# per-book counts vs bibleid metadata
$rowsByBook = @{}
foreach ($v in $verses) {
    if (-not $rowsByBook.ContainsKey($v.Book)) { $rowsByBook[$v.Book] = New-Object System.Collections.Generic.List[object] }
    $rowsByBook[$v.Book].Add($v)
}
foreach ($b in ($books | Sort-Object { $_.SN })) {
    $rows = $rowsByBook[$b.SN]
    $chap = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($r in $rows) { [void]$chap.Add($r.Chapter) }
    if ($rows.Count -ne $b.VerseNumber) { $anomalies.Add("book $($b.SN) $($b.FullName): verse count $($rows.Count) != bibleid.VerseNumber $($b.VerseNumber)  (books.js uses the extracted count)") }
    if ($chap.Count -ne $b.ChapterNumber) { $anomalies.Add("book $($b.SN) $($b.FullName): chapter count $($chap.Count) != bibleid.ChapterNumber $($b.ChapterNumber)") }
}

# FirstSN continuity
$prev = 0
foreach ($b in ($books | Sort-Object { $_.SN })) {
    if ($b.FirstSN -ne ($prev + 1)) { $anomalies.Add("book $($b.SN) $($b.FullName): FirstSN $($b.FirstSN) != expected $($prev + 1)") }
    $prev = $b.FirstSN + $b.VerseNumber - 1
}

# traditional metadata alignment
foreach ($b in ($books | Sort-Object { $_.SN })) {
    $t = $booksF | Where-Object { $_.SN -eq $b.SN } | Select-Object -First 1
    if ($null -eq $t) { $anomalies.Add("bibleidF missing SN=$($b.SN)"); continue }
    if ($t.KindSN -ne $b.KindSN -or $t.ChapterNumber -ne $b.ChapterNumber -or $t.VerseNumber -ne $b.VerseNumber -or $t.FirstSN -ne $b.FirstSN -or $t.NewOrOld -ne $b.NewOrOld -or $t.PY -ne $b.PY) {
        $anomalies.Add("bibleid/bibleidF metadata mismatch at SN=$($b.SN)")
    }
}

Add-Report '--- validation ---'
Add-Report ("duplicate keys (simplified): " + $dups)
Add-Report ("NULL texts: " + $nulls + " ; empty texts: " + $empty + " ; texts shorter than 3 chars: " + $short)
Add-Report ("chapters with a verse-number gap: " + $gapCount)
Add-Report ("keys only in simplified: " + $onlyS.Count + " ; only in traditional: " + $onlyF.Count)
Add-Report ("anomalies total: " + $anomalies.Count)
foreach ($a in $anomalies) { Add-Report ('  ! ' + $a) }
Add-Report ''

# --------------------------------------------------------------------------------------
# Write the two Bible JSON files
# --------------------------------------------------------------------------------------
function Write-VerseJson {
    param([string]$Path, $Rows)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('[')
    for ($i = 0; $i -lt $Rows.Count; $i++) {
        if ($i -gt 0) { [void]$sb.Append(',') }
        $r = $Rows[$i]
        [void]$sb.Append('[')
        [void]$sb.Append($r.Book);   [void]$sb.Append(',')
        [void]$sb.Append($r.Chapter); [void]$sb.Append(',')
        [void]$sb.Append($r.Verse);   [void]$sb.Append(',')
        [void]$sb.Append((ConvertTo-JsonString $r.Text))
        [void]$sb.Append(']')
    }
    [void]$sb.Append(']')
    [System.IO.File]::WriteAllText($Path, $sb.ToString(), $Utf8NoBom)
}

$simpPath = Join-Path $OutDir 'bible-simplified.json'
$tradPath = Join-Path $OutDir 'bible-traditional.json'
Write-VerseJson -Path $simpPath -Rows $verses
Write-VerseJson -Path $tradPath -Rows $versesF

# --------------------------------------------------------------------------------------
# Write src/shared/books.js
# --------------------------------------------------------------------------------------
$CATEGORIES = @('摩西五经', '旧约历史', '诗歌智慧', '大先知', '小先知', '福音书', '书信', '启示录')
# 与 CATEGORIES 一一对应的繁体分类名（KindSN 1..8）
$CATEGORIES_TRADITIONAL = @('摩西五經', '舊約歷史', '詩歌智慧', '大先知', '小先知', '福音書', '書信', '啟示錄')

# Real per-book counts taken from the extracted verse rows (bibleid.VerseNumber is wrong
# for 启示录: it says 403 while the 和合本 text table actually holds 404 verses).
$actual = @{}
foreach ($b in $books) {
    $rows = $rowsByBook[$b.SN]
    $chap = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($r in $rows) { [void]$chap.Add($r.Chapter) }
    $actual[$b.SN] = @{ Verses = $rows.Count; Chapters = $chap.Count }
}

Add-Report '--- bibleid metadata vs extracted text rows ---'
$metaDiff = 0
foreach ($b in ($books | Sort-Object { $_.SN })) {
    if ($actual[$b.SN].Verses -ne $b.VerseNumber -or $actual[$b.SN].Chapters -ne $b.ChapterNumber) {
        $metaDiff++
        Add-Report ('  book ' + $b.SN + ' ' + $b.FullName + ': bibleid says ' + $b.VerseNumber + ' verses / ' + $b.ChapterNumber + ' chapters, extracted ' + $actual[$b.SN].Verses + ' / ' + $actual[$b.SN].Chapters + ' -> books.js uses the extracted numbers')
    }
}
if ($metaDiff -eq 0) { Add-Report '  (no differences)' }
Add-Report ''

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("'use strict';")
[void]$sb.AppendLine('')
[void]$sb.AppendLine('// 66 books, ordered by canonical book id (1..66).')
[void]$sb.AppendLine('// category = KindSN 1..8 in the original bibleNosound.dat (see tools/extract-mdb.ps1).')
[void]$sb.AppendLine('const CATEGORIES = [')
for ($i = 0; $i -lt $CATEGORIES.Count; $i++) {
    $comma = if ($i -lt $CATEGORIES.Count - 1) { ',' } else { '' }
    [void]$sb.AppendLine('  ' + (ConvertTo-JsString $CATEGORIES[$i]) + $comma)
}
[void]$sb.AppendLine('];')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('/** 与 CATEGORIES 一一对应的繁体分类名（KindSN 1..8） */')
[void]$sb.AppendLine('const CATEGORIES_TRADITIONAL = [')
for ($i = 0; $i -lt $CATEGORIES_TRADITIONAL.Count; $i++) {
    $comma = if ($i -lt $CATEGORIES_TRADITIONAL.Count - 1) { ',' } else { '' }
    [void]$sb.AppendLine('  ' + (ConvertTo-JsString $CATEGORIES_TRADITIONAL[$i]) + $comma)
}
[void]$sb.AppendLine('];')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('/**')
[void]$sb.AppendLine(' * 取分类名。')
[void]$sb.AppendLine(' * @param {number} category KindSN（1..8）')
[void]$sb.AppendLine(' * @param {boolean} traditional 是否繁体')
[void]$sb.AppendLine(' */')
[void]$sb.AppendLine('function getCategoryName(category, traditional) {')
[void]$sb.AppendLine('  const idx = Number(category) - 1;')
[void]$sb.AppendLine('  if (idx < 0) return '''';')
[void]$sb.AppendLine('  if (traditional) return CATEGORIES_TRADITIONAL[idx] || CATEGORIES[idx] || '''';')
[void]$sb.AppendLine('  return CATEGORIES[idx] || '''';')
[void]$sb.AppendLine('}')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('const BOOKS = [')
foreach ($b in ($books | Sort-Object { $_.SN })) {
    $t = $booksF | Where-Object { $_.SN -eq $b.SN } | Select-Object -First 1
    $nameT = if ($null -ne $t) { $t.FullName } else { $b.FullName }
    $shortT = if ($null -ne $t) { $t.ShortName } else { $b.ShortName }
    $cat = $b.KindSN
    $catName = if ($cat -ge 1 -and $cat -le $CATEGORIES.Count) { $CATEGORIES[$cat - 1] } else { '未分类' }
    $catNameT = if ($cat -ge 1 -and $cat -le $CATEGORIES_TRADITIONAL.Count) { $CATEGORIES_TRADITIONAL[$cat - 1] } else { '未分類' }
    $testament = if ($b.NewOrOld) { '新约' } else { '旧约' }
    [void]$sb.AppendLine('  { id: ' + $b.SN +
        ', name: ' + (ConvertTo-JsString $b.FullName) +
        ', nameTraditional: ' + (ConvertTo-JsString $nameT) +
        ', short: ' + (ConvertTo-JsString $b.ShortName) +
        ', shortTraditional: ' + (ConvertTo-JsString $shortT) +
        ', abbr: ' + (ConvertTo-JsString $b.PY) +
        ', category: ' + $cat +
        ', categoryName: ' + (ConvertTo-JsString $catName) +
        ', categoryNameTraditional: ' + (ConvertTo-JsString $catNameT) +
        ', chapters: ' + $actual[$b.SN].Chapters +
        ', verses: ' + $actual[$b.SN].Verses +
        ', firstVerseId: ' + $b.FirstSN +
        ', testament: ' + (ConvertTo-JsString $testament) + ' },')
}
[void]$sb.AppendLine('];')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('module.exports = {')
[void]$sb.AppendLine('  CATEGORIES,')
[void]$sb.AppendLine('  CATEGORIES_TRADITIONAL,')
[void]$sb.AppendLine('  getCategoryName,')
[void]$sb.AppendLine('  BOOKS,')
[void]$sb.AppendLine('};')
[void]$sb.Append('')

$booksJsPath = Join-Path $SharedDir 'books.js'
[System.IO.File]::WriteAllText($booksJsPath, $sb.ToString(), $Utf8NoBom)

# --------------------------------------------------------------------------------------
# Category mapping (observed) + spot checks
# --------------------------------------------------------------------------------------
Add-Report '--- observed KindSN category mapping ---'
foreach ($g in ($books | Group-Object KindSN | Sort-Object { [int]$_.Name })) {
    $members = ($g.Group | Sort-Object { $_.SN } | ForEach-Object { $_.FullName }) -join '、'
    $cname = if ([int]$g.Name -ge 1 -and [int]$g.Name -le $CATEGORIES.Count) { $CATEGORIES[[int]$g.Name - 1] } else { '?' }
    Add-Report ("KindSN " + $g.Name + " (" + $cname + ", n=" + $g.Count + "): " + $members)
}
Add-Report ''

function Find-Verse {
    param($Rows, [int]$Book, [int]$Chapter, [int]$Verse)
    foreach ($r in $Rows) { if ($r.Book -eq $Book -and $r.Chapter -eq $Chapter -and $r.Verse -eq $Verse) { return $r.Text } }
    return $null
}
$spotNames = @(
    @{ Book = 1;  Chapter = 1;  Verse = 1;  Label = '创世记 1:1' },
    @{ Book = 43; Chapter = 3;  Verse = 16; Label = '约翰福音 3:16' },
    @{ Book = 20; Chapter = 3;  Verse = 5;  Label = '箴言 3:5' },
    @{ Book = 66; Chapter = 22; Verse = 21; Label = '启示录 22:21' }
)
Add-Report '--- spot checks ---'
foreach ($s in $spotNames) {
    $sv = Find-Verse $verses  $s.Book $s.Chapter $s.Verse
    $tv = Find-Verse $versesF $s.Book $s.Chapter $s.Verse
    Add-Report ($s.Label + '  简: ' + $sv)
    Add-Report ($s.Label + '  繁: ' + $tv)
}
Add-Report ''

# --------------------------------------------------------------------------------------
# Output file facts
# --------------------------------------------------------------------------------------
Add-Report '--- output files ---'
foreach ($p in @($simpPath, $tradPath, $booksJsPath)) {
    $fi = Get-Item -LiteralPath $p
    Add-Report ($fi.FullName + ' | bytes=' + $fi.Length + ' | sha256=' + (Get-Sha256 $p))
}
Add-Report ('data rows: simplified=' + $verses.Count + ' traditional=' + $versesF.Count)

[System.IO.File]::WriteAllLines($ReportFile, $report, $Utf8NoBom)

Write-Host ''
Write-Host ('rows: simplified=' + $verses.Count + ' traditional=' + $versesF.Count)
Write-Host ('anomalies: ' + $anomalies.Count)
Write-Host ('wrote: ' + $simpPath)
Write-Host ('wrote: ' + $tradPath)
Write-Host ('wrote: ' + $booksJsPath)
Write-Host ('wrote: ' + $ReportFile)
