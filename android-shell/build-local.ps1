$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $repoRoot '.android-build'
$buildToolsDir = Get-ChildItem -LiteralPath (Join-Path $androidRoot 'build-tools') -Directory | Select-Object -First 1
$platformDir = Get-ChildItem -LiteralPath (Join-Path $androidRoot 'platform-35') -Directory | Select-Object -First 1
if (-not $buildToolsDir -or -not $platformDir) { throw 'Android build tools are missing under .android-build' }

$aapt2 = Join-Path $buildToolsDir.FullName 'aapt2.exe'
$d8 = Join-Path $buildToolsDir.FullName 'd8.bat'
$zipalign = Join-Path $buildToolsDir.FullName 'zipalign.exe'
$apksigner = Join-Path $buildToolsDir.FullName 'apksigner.bat'
$androidJar = Join-Path $platformDir.FullName 'android.jar'
$javac = (Get-Command javac).Source
$keytool = (Get-Command keytool).Source

$stageRoot = Join-Path $env:TEMP 'zhengdu-android-stage'
if (Test-Path -LiteralPath $stageRoot) {
    $resolvedStage = (Resolve-Path -LiteralPath $stageRoot).Path
    $tempRoot = (Resolve-Path -LiteralPath $env:TEMP).Path
    if (-not $resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to clean unsafe path: $resolvedStage" }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'app') -Destination (Join-Path $stageRoot 'app') -Recurse -Force
$webDist = Join-Path $repoRoot 'dist-web'
if (-not (Test-Path -LiteralPath (Join-Path $webDist 'index.html'))) { throw 'dist-web is missing. Run npm run build first.' }
$webAssets = Join-Path $stageRoot 'app\src\main\assets\www'
New-Item -ItemType Directory -Path $webAssets -Force | Out-Null
Copy-Item -Path (Join-Path $webDist '*') -Destination $webAssets -Recurse -Force
Copy-Item -LiteralPath (Join-Path $androidRoot 'platform-35\android-35\android.jar') -Destination (Join-Path $stageRoot 'android.jar') -Force
Copy-Item -LiteralPath $buildToolsDir.FullName -Destination (Join-Path $stageRoot 'tools') -Recurse -Force
$aapt2 = Join-Path (Join-Path $stageRoot 'tools') 'aapt2.exe'
$d8 = Join-Path (Join-Path $stageRoot 'tools') 'd8.bat'
$zipalign = Join-Path (Join-Path $stageRoot 'tools') 'zipalign.exe'
$apksigner = Join-Path (Join-Path $stageRoot 'tools') 'apksigner.bat'
$androidJar = Join-Path $stageRoot 'android.jar'

$stageApp = Join-Path $stageRoot 'app'
$resDir = Join-Path $stageApp 'src\main\res'
$manifest = Join-Path $stageApp 'src\main\AndroidManifest.xml'
$javaDir = Join-Path $stageApp 'src\main\java'
$work = Join-Path $stageRoot 'work'
$resZip = Join-Path $work 'resources.zip'
$baseApk = Join-Path $work 'base-unsigned.apk'
$genDir = Join-Path $work 'gen'
$classesDir = Join-Path $work 'classes'
$dexDir = Join-Path $work 'dex'
$withDex = Join-Path $work 'with-dex.apk'
$alignedApk = Join-Path $work 'aligned.apk'
$signedApk = Join-Path $work 'zhengdu-signed.apk'
$keystore = Join-Path $androidRoot 'zhengdu-debug.keystore'
$outputApk = Join-Path (Split-Path -Parent $repoRoot) '争渡+Zhengdu1.0.apk'
New-Item -ItemType Directory -Path $work,$genDir,$classesDir,$dexDir -Force | Out-Null

Write-Host 'Compiling Android resources...'
& $aapt2 compile --dir $resDir -o $resZip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Write-Host 'Linking Android resources...'
& $aapt2 link -o $baseApk -I $androidJar -A (Join-Path $stageApp 'src\main\assets') --manifest $manifest --java $genDir --auto-add-overlay $resZip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host 'Compiling Java sources...'
$sourceFiles = @(Get-ChildItem -LiteralPath $javaDir -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
$sourceFiles += (Get-ChildItem -LiteralPath $genDir -Recurse -Filter 'R.java' | ForEach-Object { $_.FullName })
$sourcesFile = Join-Path $work 'sources.txt'
[IO.File]::WriteAllLines($sourcesFile, $sourceFiles, (New-Object System.Text.UTF8Encoding($false)))
& $javac --release 8 -parameters -encoding UTF-8 -classpath $androidJar -d $classesDir "@$sourcesFile"
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host 'Dexing classes...'
$classFiles = @(Get-ChildItem -LiteralPath $classesDir -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
& $d8 --release --min-api 23 --lib $androidJar --output $dexDir @classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Write-Host 'Packaging APK...'
$dexFile = Join-Path $dexDir 'classes.dex'
& python -c "import shutil,zipfile,sys; shutil.copyfile(sys.argv[1],sys.argv[3]); z=zipfile.ZipFile(sys.argv[3],'a',zipfile.ZIP_DEFLATED); z.write(sys.argv[2],'classes.dex'); z.close()" $baseApk $dexFile $withDex
if ($LASTEXITCODE -ne 0) { throw 'packaging classes.dex failed' }

& $zipalign -f 4 $withDex $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

if (-not (Test-Path -LiteralPath $keystore)) {
    Write-Host 'Creating local signing key...'
    & $keytool -genkeypair -keystore $keystore -storepass zhengdu123 -alias zhengdu -keypass zhengdu123 -dname 'CN=Zhengdu, OU=Local, O=Zhengdu, L=Local, ST=Local, C=CN' -keyalg RSA -keysize 2048 -validity 10000
    if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}

Write-Host 'Signing APK...'
& $apksigner sign --ks $keystore --ks-pass pass:zhengdu123 --key-pass pass:zhengdu123 --out $signedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

& $apksigner verify --verbose $signedApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }

Copy-Item -LiteralPath $signedApk -Destination $outputApk -Force
$item = Get-Item -LiteralPath $outputApk
Write-Host ("APK created: {0} ({1:N0} bytes)" -f $item.FullName, $item.Length)